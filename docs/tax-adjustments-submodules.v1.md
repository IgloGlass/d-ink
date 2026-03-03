# Tax Adjustments Submodules (V1, Draft for Review)

## Metadata
- Owner: Product/Tax
- Date: 2026-03-03
- Status: Draft (not yet locked)
- Scope: UI information architecture and sidebar structure only

## Proposed Usability-First Sidebar Structure (Draft)

Note:
- This is a navigation and prioritization proposal for UI usability.
- It does not define final tax logic or legal dependency order.

### Group A: Core Adjustments (Common Returns First)

1. General Client Information
2. Trial Balance to Local GAAP
3. Disallowed Expenses
4. Non-Taxable Income
5. Provisions
6. Depreciation on Tangible and Acquired Intangible Assets
7. Group Contributions
8. Items Not Included in the Books
9. Tax Losses Carried Forward

### Group B: Frequent Contextual Adjustments

10. Property Tax and Property Fee
11. Warranty Provision
12. Pension Costs and Basis for Special Employer’s Contribution
13. Buildings, Building Improvements, Leasehold Improvements, Land Improvements, and Capital Gains on Sale of Commercial Property
14. Capital Assets and Unrealized Changes
15. Obsolescence Reserve for Inventory
16. Shares and Participations
17. Shares and Participations – Average Method
18. Partnership Interest (Handelsbolag) – N3B

### Group C: Specialized/Advanced Adjustments

19. CFC Taxation
20. Yield Tax, Risk Tax, and Renewable Energy
21. Hybrid and Targeted Interest Limitation Rules, and Offsetting of Net Interest
22. Deductible Net Interest Under the General Interest Deduction Limitation Rule
23. Notional Income on Tax Allocation Reserve
24. Reversal of Tax Allocation Reserve
25. Allocation to Tax Allocation Reserve
26. Increased Deduction for Restricted Tax Losses Carried Forward (TLCF)

### Group D: Tax Calculation Chain (Pinned Bottom Section)

27. Tax Calculation Before Deduction of Prior-Year Losses and Negative Net Interest
28. Tax Calculation After Deduction for Negative Net Interest and Tax Losses Carried Forward
29. Tax Calculation After Deduction for Negative Net Interest, Tax Allocation Reserve, and Tax Losses
30. Final Tax Calculation

## Canonical Submodule Inventory (Original Ordered List, Unchanged)

1. General Client Information
2. Trial Balance to Local GAAP
3. Provisions
4. Buildings, Building Improvements, Leasehold Improvements, Land Improvements, and Capital Gains on Sale of Commercial Property
5. Capital Assets and Unrealized Changes
6. CFC Taxation
7. Non-Taxable Income
8. Yield Tax, Risk Tax, and Renewable Energy
9. Group Contributions
10. Disallowed Expenses
11. Pension Costs and Basis for Special Employer’s Contribution
12. Depreciation on Tangible and Acquired Intangible Assets
13. Shares and Participations
14. Partnership Interest (Handelsbolag) - N3B
15. Property Tax and Property Fee
16. Warranty Provision
17. Notional Income on Tax Allocation Reserve
18. Obsolescence Reserve for Inventory
19. Shares and Participations - Average Method
20. Items Not Included in the Books
21. Hybrid and Targeted Interest Limitation Rules, and Offsetting of Net Interest
22. Tax Calculation Before Deduction of Prior-Year Losses and Negative Net Interest
23. Tax Calculation After Deduction for Negative Net Interest and Tax Losses Carried Forward
24. Tax Losses Carried Forward
25. Reversal of Tax Allocation Reserve
26. Deductible Net Interest Under the General Interest Deduction Limitation Rule
27. Increased Deduction for Restricted Tax Losses Carried Forward (TLCF)
28. Allocation to Tax Allocation Reserve
29. Tax Calculation After Deduction for Negative Net Interest, Tax Allocation Reserve, and Tax Losses
30. Final Tax Calculation

## UI Placement Notes (Draft)
- These submodules are intended for the Tax Adjustments core module sidebar.
- `Final Tax Calculation` remains the final sidebar item.
- Group A should be expanded by default.
- Groups B and C should be collapsed by default under `Advanced`.
- Group D should be visually pinned near the bottom as the calculation chain.
- Core module tab label remains `Tax Adjustments`.

## Explicit Deferrals (Do Not Implement Yet)
- Account-to-submodule mapping rules.
- Detailed tax logic, thresholds, and formulas per submodule.
- Deterministic calculation sequencing between submodules.
- AI policy/module-spec logic per submodule.
- Data persistence schema changes tied to submodule internals.

## Open Review Items
- Confirm exact naming/spelling for all submodule labels.
- Confirm whether Group A ordering matches your typical "easy return" workflow.
- Confirm whether any Group B items should move into Group A.
- Confirm whether Group C should be fully behind `Advanced` by default.
- Confirm expected section header names in Swedish vs English for production UI.
