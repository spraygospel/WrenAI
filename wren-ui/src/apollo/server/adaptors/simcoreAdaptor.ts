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

// --- TAMBAHKAN FUNGSI HELPER BARU DI SINI ---
/**
 * Mengonversi SQL generik yang menggunakan kutip ganda (") menjadi
 * dialek MySQL yang menggunakan backtick (`).
 * @param sql - String SQL yang akan dikonversi.
 * @returns String SQL yang kompatibel dengan MySQL.
 */
const _toMySQLDialect = (sql: string): string => {
  // Regex ini akan mengganti semua kutip ganda yang mengapit kata (identifier)
  // dengan backtick, sambil mengabaikan kutip ganda di dalam string literal.
  return sql.replace(/"([^"]+)"/g, '`$1`');
};
// ------------------------------------------

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
    
    // --- UBAH LOGIKA DI SINI ---
    const mysqlSql = _toMySQLDialect(sql);
    logger.debug(`Original SQL: ${sql}`);
    logger.debug(`Converted MySQL SQL: ${mysqlSql}`);
    const previewLimit = options.limit || 100;
    logger.debug(`Executing SIM Core query with limit: ${previewLimit}`);
    // ---------------------------

    try {
      const response: AxiosResponse = await axios.post(
        `${this._connectionInfo.apiUrl}/api/dynamicquery`,
        // --- GUNAKAN SQL YANG SUDAH DIKONVERSI ---
        { query: mysqlSql },
        // -------------------------------------
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

      const columns: string[] = simcoreData.columns.map(c => c.columnName);
      const dtypes: Record<string, string> = simcoreData.columns.reduce((acc, c) => {
        acc[c.columnName] = transformSimcoreType(c.columnType);
        return acc;
      }, {});

      const limit = options.limit || DEFAULT_PREVIEW_LIMIT;
      const dataKeys = simcoreData.table.length > 0 ? Object.keys(simcoreData.table[0]) : [];

      const transformedData = simcoreData.table.slice(0, previewLimit).map(rowObject => {
        return columns.map(pascalCaseColumnName => {
          const matchingKey = dataKeys.find(key => key.toLowerCase() === pascalCaseColumnName.toLowerCase());
          return matchingKey ? rowObject[matchingKey] : null;
        });
      });

      return {
        columns,
        data: transformedData,
        dtypes,
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

  // --- Metode tidak didukung tetap sama ---
  public async getTables(dataSource: DataSourceName, connectionInfo: any): Promise<CompactTable[]> {
    throw new Error('getTables is not supported for SIMCORE data source.');
  }
  // ... (sisa metode tidak didukung biarkan sama)
  public async getConstraints(dataSource: DataSourceName, connectionInfo: any): Promise<RecommendConstraint[]> {
    throw new Error('getConstraints is not supported for SIMCORE data source.');
  }

  public async dryRun(query: string, options: IbisQueryOptions): Promise<any> {
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
    return Promise.resolve('SIMCORE API v1.0');
  }
}