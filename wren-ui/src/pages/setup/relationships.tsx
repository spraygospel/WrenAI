import { useMemo } from 'react';
import SimpleLayout from '@/components/layouts/SimpleLayout';
import ContainerCard from '@/components/pages/setup/ContainerCard';
import useSetupRelations from '@/hooks/useSetupRelations';
import { SETUP_STEPS } from '@/components/pages/setup/utils';

export default function SetupRelationships() {
  const {
    fetching,
    stepKey,
    recommendRelationsResult,
    dataSourceType,
    onNext,
    onBack,
    onSkip,
    submitting,
  } = useSetupRelations();

  const current = useMemo(() => SETUP_STEPS[stepKey], [stepKey]);

  return (
    <SimpleLayout>
      <ContainerCard step={current.step} maxWidth={current.maxWidth}>
        <current.component
          fetching={fetching}
          {...recommendRelationsResult}
          dataSourceType={dataSourceType}
          onNext={onNext}
          onBack={onBack}
          onSkip={onSkip}
          submitting={submitting}
        />
      </ContainerCard>
    </SimpleLayout>
  );
}
