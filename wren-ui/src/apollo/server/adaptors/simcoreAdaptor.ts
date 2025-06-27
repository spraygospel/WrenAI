// wren-ui/src/apollo/server/adaptors/simcoreAdaptor.ts
import axios, { AxiosResponse } from 'axios';
import { getLogger } from '@server/utils/logger';
import { Manifest } from '@server/mdl/type';
import * as Errors from '@server/utils/error';
import {
  IIbisAdaptor,
  IbisQueryOptions,
  IbisQueryResponse,
  ValidationRules,
  WrenSQL,
} from './ibisAdaptor';
import {
  SIMCORE_CONNECTION_INFO,
  DialectSQL,
} from '@server/models/adaptor';
import {
  CompactTable,
  DEFAULT_PREVIEW_LIMIT,
  RecommendConstraint,
} from '@server/services';
import { DataSourceName } from '@server/types';

const logger = getLogger('SimcoreAdaptor');
logger.level = 'debug';

// Helper to transform SIM Core's System.Type to a simplified type
const transformSimcoreType = (simcoreType: string): string => {
  const lowerType = simcoreType.toLowerCase();
  if (lowerType.includes('int') || lowerType.includes('decimal') || lowerType.includes('double')) {
    return 'number';
  }
  if (lowerType.includes('date') || lowerType.includes('time')) {
    return 'datetime';
  }
  if (lowerType.includes('bool')) {
    return 'boolean';
  }
  return 'string';
};

export class SimcoreAdaptor implements IIbisAdaptor {
  private _connectionInfo: SIMCORE_CONNECTION_INFO;
  private _token: string | null = null;
  private _tokenExpiry: number | null = null;

  constructor(connectionInfo: SIMCORE_CONNECTION_INFO) {
    this._connectionInfo = connectionInfo;
  }

  private async _login(): Promise<void> {
    logger.debug('Attempting to login to SIM Core API...');
    try {
      const response: AxiosResponse = await axios.post(
        `${this._connectionInfo.apiUrl}/api/login`,
        {
          user: this._connectionInfo.user,
          password: this._connectionInfo.password,
        },
      );

      const token = response.data?.rows?.[0]?.token;
      if (!token) {
        throw new Error('Login response did not contain a token.');
      }

      this._token = token;
      // Set expiry to 23 hours from now to be safe (token is valid for 24h)
      this._tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
      logger.debug('Successfully logged in and stored new token.');
    } catch (e) {
      const errorMessage = e.response?.data?.message || e.message;
      logger.error(`SIM Core login failed: ${errorMessage}`);
      throw Errors.create(Errors.GeneralErrorCodes.IBIS_SERVER_ERROR, {
        customMessage: `SIM Core API login failed: ${errorMessage}`,
        originalError: e,
      });
    }
  }

  private _isTokenValid(): boolean {
    return this._token && this._tokenExpiry && Date.now() < this._tokenExpiry;
  }

  private async _ensureValidToken(): Promise<void> {
    if (!this._isTokenValid()) {
      logger.debug('Token is invalid or expired. Logging in again.');
      await this._login();
    }
  }

  public async query(sql: string, options: IbisQueryOptions): Promise<IbisQueryResponse> {
    await this._ensureValidToken();
    logger.debug(`Executing SIM Core query with limit: ${options.limit || DEFAULT_PREVIEW_LIMIT}`);

    try {
      const response: AxiosResponse = await axios.post(
        `${this._connectionInfo.apiUrl}/api/dynamicquery`,
        { query: sql }, // SIM Core API expects the query in the body
        {
          headers: {
            Authorization: `Bearer ${this._token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const simcoreData = response.data;
      if (!simcoreData.result) {
        throw new Error(simcoreData.message || 'SIM Core API returned an error.');
      }

      // --- Data Transformation ---
      // Transform the SIM Core response to the IbisQueryResponse format expected by the app.
      const columns: string[] = simcoreData.columns.map(c => c.columnName);
      const dtypes: Record<string, string> = simcoreData.columns.reduce((acc, c) => {
        acc[c.columnName] = transformSimcoreType(c.columnType);
        return acc;
      }, {});

      const limit = options.limit || DEFAULT_PREVIEW_LIMIT;
      const data = simcoreData.table.slice(0, limit);

      return {
        columns,
        data,
        dtypes,
        // These fields are not applicable to SIM Core but are part of the interface
        correlationId: null,
        processTime: null,
        cacheHit: false,
        cacheCreatedAt: null,
        cacheOverrodeAt: null,
        override: false,
      };
    } catch (e) {
      const errorMessage = e.response?.data?.message || e.message;
      logger.error(`SIM Core query failed: ${errorMessage}`);
      throw Errors.create(Errors.GeneralErrorCodes.IBIS_SERVER_ERROR, {
        customMessage: `SIM Core API query failed: ${errorMessage}`,
        originalError: e,
      });
    }
  }

  // --- UNSUPPORTED METHODS ---
  // These methods are part of the IIbisAdaptor interface but are not supported by the SIM Core API.
  // We implement them to throw a clear error, preventing accidental use.

  public async getTables(dataSource: DataSourceName, connectionInfo: any): Promise<CompactTable[]> {
    throw new Error('getTables is not supported for SIMCORE data source.');
  }

  public async getConstraints(dataSource: DataSourceName, connectionInfo: any): Promise<RecommendConstraint[]> {
    throw new Error('getConstraints is not supported for SIMCORE data source.');
  }

  public async dryRun(query: string, options: IbisQueryOptions): Promise<any> {
    // We can simulate a successful dryRun by simply returning a resolved promise,
    // as the primary check (login) is handled by the query method.
    return Promise.resolve({ correlationId: null });
  }

  public async validate(dataSource: DataSourceName, rule: ValidationRules, connectionInfo: any, mdl: Manifest, parameters: Record<string, any>): Promise<any> {
    throw new Error('validate is not supported for SIMCORE data source.');
  }

  public async getNativeSql(options: any): Promise<string> {
    throw new Error('getNativeSql is not supported for SIMCORE data source.');
  }

  public async modelSubstitute(sql: DialectSQL, options: any): Promise<WrenSQL> {
    throw new Error('modelSubstitute is not supported for SIMCORE data source.');
  }

  public async getVersion(dataSource: DataSourceName, connectionInfo: any): Promise<string> {
    // Can return a static version string as it's not discoverable.
    return Promise.resolve('SIMCORE API v1.0');
  }
}