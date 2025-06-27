// wren-ui/src/apollo/server/adaptors/tests/simcoreAdaptor.test.ts
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { SimcoreAdaptor } from '../simcoreAdaptor';
import { SIMCORE_CONNECTION_INFO } from '@server/models/adaptor';
import { IbisQueryOptions } from '../ibisAdaptor';
import { DataSourceName } from '@server/types';

// Initialize a mock adapter for axios
const mock = new MockAdapter(axios);

describe('SimcoreAdaptor', () => {
  const connectionInfo: SIMCORE_CONNECTION_INFO = {
    apiUrl: 'http://35.240.140.249:5001',
    user: 'AIAgent',
    password: 'deepseek',
  };

  const mockQueryOptions: IbisQueryOptions = {
    dataSource: 'SIMCORE' as DataSourceName,
    connectionInfo,
    mdl: { models: [], relationships: [] }, // Dummy manifest
  };

  const mockLoginResponse = {
    result: true,
    message: '',
    rows: [
      {
        token: 'fake-jwt-token',
      },
    ],
  };

  const mockQueryResponse = {
    result: true,
    message: '',
    table: [
      { code: 'IDR', name: 'Rupiah' },
      { code: 'USD', name: 'US Dollar' },
    ],
    columns: [
      { columnName: 'code', columnType: 'System.String' },
      { columnName: 'name', columnType: 'System.String' },
    ],
  };

  // Reset mocks before each test
  beforeEach(() => {
    mock.reset();
  });

  it('should login successfully and store the token', async () => {
    // Mock the login API endpoint
    mock
      .onPost(`${connectionInfo.apiUrl}/api/login`)
      .reply(200, mockLoginResponse);

    const adaptor = new SimcoreAdaptor(connectionInfo);
    // Directly call the private method for testing purposes
    await (adaptor as any)._login();

    // Check if the token is stored correctly
    expect((adaptor as any)._token).toBe('fake-jwt-token');
    expect((adaptor as any)._tokenExpiry).toBeGreaterThan(Date.now());
  });

  it('should execute a query successfully after logging in', async () => {
    // Mock both login and query endpoints
    mock
      .onPost(`${connectionInfo.apiUrl}/api/login`)
      .reply(200, mockLoginResponse);
    mock
      .onPost(`${connectionInfo.apiUrl}/api/dynamicquery`)
      .reply(200, mockQueryResponse);

    const adaptor = new SimcoreAdaptor(connectionInfo);
    const result = await adaptor.query(
      'SELECT * FROM mastercurrency',
      mockQueryOptions,
    );

    // Verify the output is transformed correctly
    expect(result.columns).toEqual(['code', 'name']);
    expect(result.data).toEqual([
      { code: 'IDR', name: 'Rupiah' },
      { code: 'USD', name: 'US Dollar' },
    ]);
    expect(result.dtypes).toEqual({
      code: 'string',
      name: 'string',
    });
    // Verify that the login endpoint was called once
    expect(mock.history.post.length).toBe(2); // 1 for login, 1 for query
  });

  it('should use an existing valid token without logging in again', async () => {
    // Mock only the query endpoint for this test
    mock
      .onPost(`${connectionInfo.apiUrl}/api/dynamicquery`)
      .reply(200, mockQueryResponse);

    const adaptor = new SimcoreAdaptor(connectionInfo);

    // Manually set a valid token
    (adaptor as any)._token = 'existing-valid-token';
    (adaptor as any)._tokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour from now

    await adaptor.query('SELECT * FROM users', mockQueryOptions);

    // Verify that the login endpoint was NOT called
    // There should only be one call in history, which is the query call
    expect(mock.history.post.length).toBe(1);
    expect(mock.history.post[0].url).toBe(`${connectionInfo.apiUrl}/api/dynamicquery`);
  });
  
  it('should throw an error if login fails', async () => {
    // Mock a failed login response
    mock.onPost(`${connectionInfo.apiUrl}/api/login`).reply(401, {
      result: false,
      message: 'Invalid credentials',
    });

    const adaptor = new SimcoreAdaptor(connectionInfo);

    // We expect the query method to throw an error
    await expect(adaptor.query('SELECT 1', mockQueryOptions)).rejects.toThrow(
      'SIM Core API login failed: Invalid credentials',
    );
  });

  it('should throw an error if query fails', async () => {
    // Mock a successful login but a failed query
    mock
      .onPost(`${connectionInfo.apiUrl}/api/login`)
      .reply(200, mockLoginResponse);
    mock.onPost(`${connectionInfo.apiUrl}/api/dynamicquery`).reply(500, {
      result: false,
      message: 'SQL syntax error',
    });

    const adaptor = new SimcoreAdaptor(connectionInfo);

    await expect(
      adaptor.query('SELECT FROM invalid-table', mockQueryOptions),
    ).rejects.toThrow('SIM Core API query failed: SQL syntax error');
  });

  it('should throw errors for unsupported metadata methods', async () => {
    const adaptor = new SimcoreAdaptor(connectionInfo);
    
    await expect(adaptor.getTables('SIMCORE' as DataSourceName, {})).rejects.toThrow(
        'getTables is not supported for SIMCORE data source.'
    );

    await expect(adaptor.getConstraints('SIMCORE' as DataSourceName, {})).rejects.toThrow(
        'getConstraints is not supported for SIMCORE data source.'
    );
  });
});