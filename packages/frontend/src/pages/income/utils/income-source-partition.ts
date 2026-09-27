import { INCOME_SOURCE_STATUS, type IncomeSourceModel } from '@bt/shared/types/income';

interface PartitionedIncomeSources {
  active: IncomeSourceModel[];
  ended: IncomeSourceModel[];
}

export const compareIncomeSourcesByLatestCreditDate = (a: IncomeSourceModel, b: IncomeSourceModel): number => {
  const dateA = a.latestCreditDate;
  const dateB = b.latestCreditDate;

  if (dateA && dateB) {
    const diff = dateB.localeCompare(dateA);
    if (diff !== 0) return diff;
  } else if (dateA) {
    return -1;
  } else if (dateB) {
    return 1;
  }

  return (b.startDate || '').localeCompare(a.startDate || '');
};

export const partitionIncomeSources = ({ sources }: { sources: IncomeSourceModel[] }): PartitionedIncomeSources => {
  const sorted = [...sources].sort(compareIncomeSourcesByLatestCreditDate);
  const partitioned: PartitionedIncomeSources = { active: [], ended: [] };
  for (const source of sorted) {
    if (source.status === INCOME_SOURCE_STATUS.ended) {
      partitioned.ended.push(source);
    } else {
      partitioned.active.push(source);
    }
  }
  return partitioned;
};
