// wren-ui/src/hooks/useSetupModels.tsx

import { useState, useEffect } from 'react';
import { Path, SETUP } from '@/utils/enum';
import { useRouter } from 'next/router';
import {
  useListDataSourceTablesQuery,
  useSaveTablesMutation,
} from '@/apollo/client/graphql/dataSource.generated';
import { useGetSettingsQuery } from '@/apollo/client/graphql/settings.generated'; 
import { DataSourceName } from '@/apollo/client/graphql/__types__'; 
import { CompactTable } from '@/apollo/server/services'; 

export default function useSetupModels() {
  const [stepKey] = useState(SETUP.SELECT_MODELS);
  const router = useRouter();

  // State baru untuk menampung tabel dari JSON
  const [localTables, setLocalTables] = useState<CompactTable[]>([]);
  const [schemaJSON, setSchemaJSON] = useState<string | null>(null); 

  // 1. Ambil data settings untuk mengetahui tipe data source saat ini
  const { data: settingsData, loading: settingsLoading } = useGetSettingsQuery();

  // 2. Tetap jalankan query GraphQL, tapi dengan kondisi
  const { data: gqlData, loading: gqlLoading } = useListDataSourceTablesQuery({
    fetchPolicy: 'no-cache',
    // Hanya jalankan query ini jika tipe BUKAN SIMCORE
    skip: settingsData?.settings.dataSource.type === DataSourceName.SIMCORE,
    onError: (error) => console.error(error),
  });

  const [saveTablesMutation, { loading: submitting }] = useSaveTablesMutation();

  // 3. Gunakan useEffect untuk mengambil data dari file JSON jika tipenya SIMCORE
  useEffect(() => {
    const dataSourceType = settingsData?.settings.dataSource.type;
    if (dataSourceType === DataSourceName.SIMCORE) {
      console.log('SIMCORE detected, fetching schema from erp_schema.json...');
      const fetchSchema = async () => {
        try {
          const response = await fetch('/erp_schema.json');
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const schema = await response.json();
          setSchemaJSON(JSON.stringify(schema)); 
          
          // Transformasi data dari erp_schema.json ke format CompactTable
          const transformedTables: CompactTable[] = Object.entries(schema.tables).map(
            ([tableName, tableData]: [string, any]) => ({
              __typename: 'CompactTable', // Diperlukan untuk Apollo Client
              name: tableName,
              columns: tableData.columns.map((col: any) => ({
                __typename: 'CompactColumn',
                name: col.name,
                type: col.type,
                properties: null, // Properti bisa null
              })),
              properties: null,
            })
          );

          setLocalTables(transformedTables);
          console.log('Schema successfully loaded from JSON.', transformedTables);
        } catch (error) {
          console.error("Failed to fetch or parse 'erp_schema.json'", error);
          // Anda bisa menambahkan notifikasi error untuk user di sini jika perlu
        }
      };
      fetchSchema();
    }
  }, [settingsData]); // Jalankan efek ini ketika settingsData sudah tersedia

  const submitModels = async (tables: string[]) => {
    await saveTablesMutation({
      variables: {
        data: {
          tables,
          schemaJSON: schemaJSON,
        },
      },
    });
    router.push(Path.OnboardingRelationships);
  };

  const onBack = () => {
    router.push(Path.OnboardingConnection);
  };

  const onNext = (data: { selectedTables: string[] }) => {
    submitModels(data.selectedTables);
  };

  // 4. Tentukan data dan status loading mana yang akan digunakan
  const isSimcore = settingsData?.settings.dataSource.type === DataSourceName.SIMCORE;
  const fetching = isSimcore ? settingsLoading || (localTables.length === 0 && !settingsLoading) : gqlLoading;
  const tables = isSimcore ? localTables : (gqlData?.listDataSourceTables || []);

  return {
    submitting,
    fetching,
    stepKey,
    onBack,
    onNext,
    tables,
  };
}