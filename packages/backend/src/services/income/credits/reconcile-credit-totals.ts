import { INCOME_COMPONENT_KIND } from '@bt/shared/types/income';
import { Money } from '@common/types/money';

export interface ReconcileComponentInput {
  kind: INCOME_COMPONENT_KIND;
  amount: Money;
}

export interface ReconciledCreditTotals {
  grossAmount: Money;
  totalDeductions: Money;
  netAmount: Money;
  employerContributions: Money;
}

/**
 * Derives a credit's aggregate amounts from its component breakdown.
 * Components are the source of truth; these aggregates are a materialised
 * convenience for querying/summary code that shouldn't have to join+sum
 * IncomeCreditComponents every time.
 */
export function reconcileCreditTotals(components: ReconcileComponentInput[]): ReconciledCreditTotals {
  let grossAmount = Money.zero();
  let totalDeductions = Money.zero();
  let employerContributions = Money.zero();

  for (const component of components) {
    switch (component.kind) {
      case INCOME_COMPONENT_KIND.earning:
        grossAmount = grossAmount.add(component.amount);
        break;
      case INCOME_COMPONENT_KIND.deduction:
        totalDeductions = totalDeductions.add(component.amount);
        break;
      case INCOME_COMPONENT_KIND.employer_contribution:
        employerContributions = employerContributions.add(component.amount);
        break;
    }
  }

  return {
    grossAmount,
    totalDeductions,
    netAmount: grossAmount.subtract(totalDeductions),
    employerContributions,
  };
}
