import { DataSourceName } from '@server/types';
import { Manifest } from '@server/mdl/type';
import { IWrenEngineAdaptor } from '../adaptors/wrenEngineAdaptor';
import { IAdaptorFactory } from '@/common';
import {
  SupportedDataSource,
  IbisQueryResponse,
  ValidationRules,
  IbisResponse,
} from '../adaptors/ibisAdaptor';
import { getLogger } from '@server/utils';
import { Project } from '../repositories';
import { PostHogTelemetry, TelemetryEvent } from '../telemetry/telemetry';

const logger = getLogger('QueryService');
logger.level = 'debug';

export const DEFAULT_PREVIEW_LIMIT = 500;

export interface ColumnMetadata {
  name: string;
  type: string;
}

export interface PreviewDataResponse extends IbisResponse {
  columns: ColumnMetadata[];
  data: any[][];
  cacheHit?: boolean;
  cacheCreatedAt?: string;
  cacheOverrodeAt?: string;
  override?: boolean;
}

export interface DescribeStatementResponse {
  columns: ColumnMetadata[];
}

export interface PreviewOptions {
  project: Project;
  modelingOnly?: boolean;
  // if not given, will use the deployed manifest
  manifest: Manifest;
  limit?: number;
  dryRun?: boolean;
  refresh?: boolean;
  cacheEnabled?: boolean;
}

export interface SqlValidateOptions {
  project: Project;
  mdl: Manifest;
  modelingOnly?: boolean;
}

export interface ValidateResponse {
  valid: boolean;
  message?: string;
}

export interface IQueryService {
  preview(
    sql: string,
    options: PreviewOptions,
  ): Promise<IbisResponse | PreviewDataResponse | boolean>;

  describeStatement(
    sql: string,
    options: PreviewOptions,
  ): Promise<DescribeStatementResponse>;

  validate(
    project: Project,
    rule: ValidationRules,
    manifest: Manifest,
    parameters: Record<string, any>,
  ): Promise<ValidateResponse>;
}

export class QueryService implements IQueryService {
  private readonly adaptorFactory: IAdaptorFactory;
  private readonly wrenEngineAdaptor: IWrenEngineAdaptor;
  private readonly telemetry: PostHogTelemetry;

  constructor({
    adaptorFactory,
    wrenEngineAdaptor,
    telemetry,
  }: {
    adaptorFactory: IAdaptorFactory; // <<< UBAH
    wrenEngineAdaptor: IWrenEngineAdaptor;
    telemetry: PostHogTelemetry;
  }) {
    this.adaptorFactory = adaptorFactory; // <<< UBAH
    this.wrenEngineAdaptor = wrenEngineAdaptor;
    this.telemetry = telemetry;
  }

  public async preview(
    sql: string,
    options: PreviewOptions,
  ): Promise<IbisResponse | PreviewDataResponse | boolean> {
    const {
      project,
      manifest: mdl,
      limit,
      dryRun,
      refresh,
      cacheEnabled,
    } = options;
    const { type: dataSource, connectionInfo } = project;

    // --- LOGIKA BARU MENGGUNAKAN FACTORY ---
    if (dataSource === DataSourceName.DUCKDB) {
      // Logika khusus DuckDB tetap menggunakan wrenEngineAdaptor
      if (dryRun) {
        logger.debug('Using wren engine to dry run');
        await this.wrenEngineAdaptor.dryRun(sql, { manifest: mdl, limit });
        return true;
      } else {
        logger.debug('Using wren engine to preview');
        const data = await this.wrenEngineAdaptor.previewData(sql, mdl, limit);
        return data as PreviewDataResponse;
      }
    } else {
      // Untuk SEMUA data source lain (termasuk SIMCORE, MySQL, dll.)
      logger.debug(`Using adaptor for ${dataSource} to preview`);
      const adaptor = this.adaptorFactory(dataSource, connectionInfo);

      if (dryRun) {
        // Panggil dryRun dari adaptor yang sesuai
        const res = await adaptor.dryRun(sql, { dataSource, connectionInfo, mdl });
        this.sendIbisEvent(TelemetryEvent.IBIS_DRY_RUN, res, { dataSource, sql });
        return { correlationId: res.correlationId };
      } else {
        // Panggil query dari adaptor yang sesuai
        const res = await adaptor.query(sql, {
          dataSource,
          connectionInfo,
          mdl,
          limit,
          refresh,
          cacheEnabled,
        });
        this.sendIbisEvent(TelemetryEvent.IBIS_QUERY, res, { dataSource, sql });
        const data = this.transformDataType(res);
        return {
          correlationId: res.correlationId,
          cacheHit: res.cacheHit,
          cacheCreatedAt: res.cacheCreatedAt,
          cacheOverrodeAt: res.cacheOverrodeAt,
          override: res.override,
          ...data,
        };
      }
    }
    // ------------------------------------------
  }

  public async describeStatement(
    sql: string,
    options: PreviewOptions,
  ): Promise<DescribeStatementResponse> {
    try {
      // preview data with limit 1 to get column metadata
      options.limit = 1;
      const res = (await this.preview(sql, options)) as PreviewDataResponse;
      return { columns: res.columns };
    } catch (err: any) {
      logger.debug(`Got error when describing statement: ${err.message}`);
      throw err;
    }
  }

  public async validate(
    project,
    rule: ValidationRules,
    manifest: Manifest,
    parameters: Record<string, any>,
  ): Promise<ValidateResponse> {
    const { type: dataSource, connectionInfo } = project;
    // --- UBAH LOGIKA DI SINI ---
    const adaptor = this.adaptorFactory(dataSource, connectionInfo);
    const res = await adaptor.validate(
      dataSource,
      rule,
      connectionInfo,
      manifest,
      parameters,
    );
    // ---------------------------
    return res;
  }

  private useEngine(dataSource: DataSourceName): boolean {
    if (dataSource === DataSourceName.DUCKDB) {
      return true;
    } else {
      return false;
    }
  }

  private checkDataSourceIsSupported(dataSource: DataSourceName) {
    if (
      !Object.prototype.hasOwnProperty.call(SupportedDataSource, dataSource)
    ) {
      throw new Error(`Unsupported datasource for ibis: "${dataSource}"`);
    }
  }

  private async ibisDryRun(
    sql: string,
    dataSource: DataSourceName,
    connectionInfo: any,
    mdl: Manifest,
  ): Promise<IbisResponse> {
    const event = TelemetryEvent.IBIS_DRY_RUN;
    try {
      // --- UBAH LOGIKA DI SINI ---
      const adaptor = this.adaptorFactory(dataSource, connectionInfo);
      const res = await adaptor.dryRun(sql, {
        dataSource,
        connectionInfo,
        mdl,
      });
      // ---------------------------
      this.sendIbisEvent(event, res, { dataSource, sql });
      return {
        correlationId: res.correlationId,
      };
    } catch (err: any) {
      this.sendIbisFailedEvent(event, err, { dataSource, sql });
      throw err;
    }
  }

  private async ibisQuery(
    sql: string,
    dataSource: DataSourceName,
    connectionInfo: any,
    mdl: Manifest,
    limit: number,
    refresh?: boolean,
    cacheEnabled?: boolean,
  ): Promise<PreviewDataResponse> {
    const event = TelemetryEvent.IBIS_QUERY;
    try {
      // --- UBAH LOGIKA DI SINI ---
      const adaptor = this.adaptorFactory(dataSource, connectionInfo);
      const res = await adaptor.query(sql, {
        dataSource,
        connectionInfo,
        mdl,
        limit,
        refresh,
        cacheEnabled,
      });
      // ---------------------------
      this.sendIbisEvent(event, res, { dataSource, sql });
      const data = this.transformDataType(res);
      return {
        correlationId: res.correlationId,
        cacheHit: res.cacheHit,
        cacheCreatedAt: res.cacheCreatedAt,
        cacheOverrodeAt: res.cacheOverrodeAt,
        override: res.override,
        ...data,
      };
    } catch (err: any) {
      this.sendIbisFailedEvent(event, err, { dataSource, sql });
      throw err;
    }
  }

  private transformDataType(data: IbisQueryResponse): PreviewDataResponse {
    const columns = data.columns;
    const dtypes = data.dtypes;
    const transformedColumns = columns.map((column) => {
      let type = 'unknown';
      if (dtypes && dtypes[column]) {
        type = dtypes[column] === 'object' ? 'string' : dtypes[column];
      }
      if (type === 'unknown') {
        logger.debug(`Did not find type mapping for "${column}"`);
        logger.debug(
          `dtypes mapping: ${dtypes ? JSON.stringify(dtypes, null, 2) : 'undefined'} `,
        );
      }
      return {
        name: column,
        type,
      } as ColumnMetadata;
    });
    return {
      columns: transformedColumns,
      data: data.data,
    } as PreviewDataResponse;
  }

  private sendIbisEvent(
    event: TelemetryEvent,
    res: IbisResponse,
    others: Record<string, any>,
  ) {
    this.telemetry.sendEvent(event, {
      correlationId: res.correlationId,
      processTime: res.processTime,
      ...others,
    });
  }

  private sendIbisFailedEvent(
    event: TelemetryEvent,
    err: any,
    others: Record<string, any>,
  ) {
    this.telemetry.sendEvent(
      event,
      {
        correlationId: err.extensions?.other?.correlationId,
        processTime: err.extensions?.other?.processTime,
        error: err.message,
        ...others,
      },
      err.extensions?.service,
      false,
    );
  }
}
