/** 
    This class is responsible for handling the retrieval of metadata from the data source.
    For DuckDB, we control the access logic and directly query the WrenEngine.
    For PostgreSQL and BigQuery, we will use the Ibis server API.
 */

import { IIbisAdaptor } from '../adaptors/ibisAdaptor';
import { IAdaptorFactory } from '@/common'; 
import { IWrenEngineAdaptor } from '../adaptors/wrenEngineAdaptor';
import { Project } from '../repositories';
import { DataSourceName } from '../types';
import { getLogger } from '@server/utils';

const logger = getLogger('MetadataService');
logger.level = 'debug';

export interface CompactColumn {
  name: string;
  type: string;
  notNull: boolean;
  description?: string;
  properties?: Record<string, any>;
  nestedColumns?: CompactColumn[];
}

export enum ConstraintType {
  PRIMARY_KEY = 'PRIMARY KEY',
  FOREIGN_KEY = 'FOREIGN KEY',
  UNIQUE = 'UNIQUE',
}

export interface CompactTable {
  name: string;
  columns: CompactColumn[];
  description?: string;
  properties?: Record<string, any>;
  primaryKey?: string;
}

export interface RecommendConstraint {
  constraintName: string;
  constraintType: ConstraintType;
  constraintTable: string;
  constraintColumn: string;
  constraintedTable: string;
  constraintedColumn: string;
}

export interface IDataSourceMetadataService {
  listTables(project: Project): Promise<CompactTable[]>;
  listConstraints(project: Project): Promise<RecommendConstraint[]>;
  getVersion(project: Project): Promise<string>;
}

export class DataSourceMetadataService implements IDataSourceMetadataService {
  private readonly adaptorFactory: IAdaptorFactory; 
  private readonly wrenEngineAdaptor: IWrenEngineAdaptor;

  constructor({
    adaptorFactory, // <<< UBAH
    wrenEngineAdaptor,
  }: {
    adaptorFactory: IAdaptorFactory; // <<< UBAH
    wrenEngineAdaptor: IWrenEngineAdaptor;
  }) {
    this.adaptorFactory = adaptorFactory; // <<< UBAH
    this.wrenEngineAdaptor = wrenEngineAdaptor;
  }

  public async listTables(project): Promise<CompactTable[]> {
    const { type: dataSource, connectionInfo } = project;
    if (dataSource === DataSourceName.DUCKDB) {
      const tables = await this.wrenEngineAdaptor.listTables();
      return tables;
    }
    // --- UBAH LOGIKA DI SINI ---
    const adaptor = this.adaptorFactory(dataSource, connectionInfo);
    return await adaptor.getTables(dataSource, connectionInfo);
    // ---------------------------
  }

  public async listConstraints(project: Project): Promise<RecommendConstraint[]> {
    const { type: dataSource, connectionInfo } = project;
    if (dataSource === DataSourceName.DUCKDB) {
      return [];
    }
    // --- UBAH LOGIKA DI SINI ---
    const adaptor = this.adaptorFactory(dataSource, connectionInfo);
    return await adaptor.getConstraints(dataSource, connectionInfo);
    // ---------------------------
  }

  public async getVersion(project: Project): Promise<string> {
    const { type: dataSource, connectionInfo } = project;
    // --- UBAH LOGIKA DI SINI ---
    const adaptor = this.adaptorFactory(dataSource, connectionInfo);
    return await adaptor.getVersion(dataSource, connectionInfo);
    // ---------------------------
  }
}