# Tax Adjustment Submodule Specs (V1)

## Metadata
- Owner: Product/Tax
- Started: 2026-03-17
- Last updated: 2026-03-18
- Status: All 30 modules confirmed ✅
- Purpose: Defines tax logic, AI task, user verification steps, and INK2 output for each of the 30 submodules

## Review legend
- ✅ Confirmed
- ❌ Rejected / replaced (see notes)
- 🔄 In discussion
- ⬜ Not yet reviewed

---

## Architecture: adjustment pipeline

**Critical principle**: No submodule writes directly to an INK2 code.

The data pipeline is strictly:

> **Submodules 1–21** (compute raw adjustment amounts with metadata)
> → **Calculation chain 22–30** (aggregate, sequence, apply ordering rules)
> → **Module 30** (single source of truth — maps all amounts to 4.x codes)
> → **INK2 module** (pure renderer — receives final values from module 30 only)

This ensures the INK2 form is always consistent, auditable, and never shows a partial or out-of-order result. Submodules output adjustment amounts tagged with type and legal basis; module 30 owns the final INK2 code mapping.

---

## Design decisions (agreed)
- Modules 6 (CFC), 14 (Partnership N3B), 20 (Items not in books): no full AI output — structured questionnaire + guidance text for user to verify manually
- Module 21 (Interest limitation): simplified V1 — deductible net interest = 30% of EBITDA. N9 form generation deferred to V2.
- Modules 22–30 (Calculation chain): deterministic only, no AI
- Modules 25 (Återföring) and 28 (Avsättning) are the two periodiseringsfond calculation modules; module 17 handles schablonintäkt only
- All add-backs and deductions flow to module 30 before being written to INK2 4.x codes

---

## MODULE 1 — General client information ✅

**Purpose**: Collects client context that conditions all downstream modules. No tax computation here.

**What the UI shows**:
- Company name, org number (pre-filled from annual report extraction)
- Fiscal year start/end (pre-filled)
- Accounting standard: K2 or K3 (dropdown — affects depreciation rules)
- Whether the company is part of a group (yes/no — enables group contribution module)
- Outstanding periodiseringsfonder from prior years (table: year of allocation, amount — needed for schablonintäkt in module 17)
- Underskott (tax loss carry-forwards) from prior years (amount — needed for module 24)
- Whether any ownership changes occurred during the year (yes/no — triggers underskottsspärr warning in module 24)

**AI involvement**: None. Pre-fill from annual report extraction where possible; user verifies and corrects.

**User verifies**:
- Pre-filled company data matches tax authority records
- All prior-year periodiseringsfonder are entered (from prior tax return)
- Loss carry-forward amount is correct
- Group structure flag is correct

**Output**: Structured context object passed to all other modules. No INK2 adjustment amount — only header fields.

---

## MODULE 2 — Trial balance to local GAAP ✅

**Feeds in**: `891000` (skattekostnad), `940000` (årets resultat)

**Tax issue**: Starting point for Swedish corporate tax (IL 14:2) is accounting profit **before** income tax (resultat före skatt). The booked tax cost (891000) — including both current and deferred tax — is never deductible and must be fully added back. The module establishes `INK2R.profit_before_tax`.

**AI task**: Confirm that profit before tax = årets resultat + skattekostnad. If 891000 contains a deferred tax component (common under K3/IAS 12), explain that both current and deferred tax are non-deductible and must be fully added back. Reconcile the computed figure against the profit before tax shown in the annual report income statement — flag any discrepancy as a potential trial balance mapping error.

**User verifies**:
- The computed profit_before_tax matches the annual report income statement
- Any deferred tax component is included in the add-back (not just current tax)
- Reconciliation to annual report shows no unexplained difference

**Output**: `INK2R.profit_before_tax` — deterministic base figure, not an adjustment line. This value is passed as the starting point to all downstream tax calculation submodules (modules 22, 23, 29, 30).

---

## MODULE 3 — Provisions ✅

**Feeds in**: `151500` (osäkra fordringar — doubtful receivables reserve), `229000` (övriga avsättningar — other provisions)

**Tax issue**: Under IL 17:2, bad debt deductions are allowed only when individual receivables are specifically assessed as uncollectible — general portfolio reserves are not deductible. For other provisions (IL 16:1), provisions are deductible only when the underlying cost is actually incurred; restructuring provisions, legal claim provisions, and similar are non-deductible when booked.

**AI task**: Analyze each provision type. For doubtful debts: is the write-off individually assessed, or a general reserve? If general → propose add-back. For other provisions: classify by type and propose add-back, noting that the deduction arises when the actual cash cost occurs.

**User verifies**:
- That the AI's classification of each provision is correct
- Whether any provision has been previously added back (avoid double add-back)

**Output**: Add-backs → **INK2 4.3c** (specific code may vary by provision type; 4.3c is the default non-deductible expense code).

---

## MODULE 4 — Buildings, improvements, and property gains ✅

**Feeds in**: `111000` (buildings — acquisition value BS), `115000` (land improvements BS), `123200` (leaseholder's improvements BS), `397200` (capital gain on buildings/land IS), `797200` (capital loss on buildings/land IS), `777000` / `782400` / `784000` (booked depreciation IS)

**Tax issue**: Three distinct issues:

**1. Tax vs book depreciation on buildings** (IL 19–20): Fixed annual rates on acquisition value:
- Buildings: 2–5% depending on type (industrial/warehouse 4%, offices 3%, residential 2%)
- Land improvements: 5% per year (IL 20:5)
- Leaseholder's improvements: over useful life, minimum 5 years (IL 19:27)
Unlike inventarier (module 12), there is no 30%/20% method choice — rates are fixed by building category.

**2. Capital gains on real property** (IL 45): Gains fully taxable. Losses deductible only against capital gains — excess losses carried forward.

**3. Building-on-land allocation**: On sale, gain/loss must be split between building (depreciable, subject to recapture) and land (not depreciable, straight capital gain). Land is never depreciated.

**AI task**: Identify building type from annual report notes and apply the correct rate to acquisition value. For capital gains/losses — confirm taxable amount and flag whether land/building split is needed.

**User verifies**:
- Building type classification (determines allowable rate)
- Acquisition value used as depreciation base
- Capital gain/loss matches sale proceeds in annual report
- Land vs building split if a sale occurred

**Output**: Booked depreciation added back at **INK2 4.9+**; allowable tax depreciation deducted at **INK2 4.9−** (two explicit lines, not a net figure). Capital gain → taxable addition. Capital loss → deduction (carried forward if it exceeds gains).

---

## MODULE 5 — Capital assets and unrealized changes ✅

**Feeds in**: `138400` (change in value/write-downs on financial assets BS), `367000` (capital gain/loss IS), `367200` (dividends IS), `394000` (change in value/write-downs IS), `808000` (unrealized changes on shares IS)

**Tax issue**: The key question for all items is whether the underlying asset qualifies as **näringsbetingade andelar** (IL 25a):
- If yes: dividends exempt (IL 24:17), capital gains exempt (IL 25a:5), capital losses NOT deductible (IL 25a:19)
- If no (portfolio shares): capital gains taxable, dividends taxable, capital losses deductible
- Unrealized gains/losses: never taxable/deductible regardless of classification

**AI task**: Analyze annual report notes to determine share classification. Propose: add-back for non-taxable gains/exempt dividends; no deduction for non-deductible losses; taxable treatment for portfolio investments. Always reverse unrealized changes.

**User verifies**:
- Share classification is correct (näringsbetingad vs portfolio)
- Whether any holding changed classification during the year
- That unrealized items are fully reversed

**Output**: Exempt dividends → deduction at **INK2 4.5b**. Exempt capital gains → deduction at **INK2 4.7a**. Non-deductible losses → add-back at **INK2 4.7b**. Unrealized changes → fully reversed. Taxable portfolio items → remain in base.

---

## MODULE 6 — CFC taxation ✅

**Feeds in**: Nothing from trial balance. Reads `taxDeep.foreignSubsidiariesContext` from the annual report extraction.

**Tax issue**: Under IL 39a, Swedish companies owning ≥25% of a foreign company subject to low effective taxation (<~11.3%, i.e. <55% of Swedish 20.6%) must include their proportional share of that company's income in Swedish taxable income. Extensive exemptions apply for EEA companies and white-listed jurisdictions.

**AI/UI approach**: Warning-based. If `foreignSubsidiariesContext.cfcRiskFlag` is true, the module displays a prominent warning listing the identified foreign entities. Otherwise shows a green "no CFC risk identified" status.

**Warning text** (shown when cfcRiskFlag is true):
- Lists each flagged foreign entity (name, country, ownership %)
- Explains that IL 39a may apply
- Directs user to verify the effective foreign tax rate and check Skatteverket's white list
- Provides a manual entry field for the CFC income share if applicable

**Output**: Manual entry → INK2 CFC section if applicable. No output if no CFC risk flagged.

---

## MODULE 7 — Non-taxable income ✅

**Feeds in**: `831400` (ränta på skattekonto — tax account interest income), `399300` (received gifts/donations), `399500` (composition agreement proceeds)

**Tax issue**:
- **Tax account interest (831400)**: Interest credited on the skattekonto is **not taxable** under IL 8:1. Most common item in this module — must be deducted from taxable income if booked as income.
- **Gifts (399300)**: Gifts to a company are generally taxable (IL 8:2). Exception: gifts within a closely held group. AI assesses whether this qualifies as non-taxable.
- **Composition (399500)**: Debt forgiven through a formal ackord (IL 39:2) is not taxable income — but reduces any outstanding underskott by the forgiven amount.

**AI task**: Identify and deduct tax account interest automatically. For gifts: assess whether non-taxable based on annual report context. For compositions: calculate the underskott reduction and flag to module 24.

**User verifies**:
- That the tax account interest amount matches the skattekonto statement
- Source and nature of any gift (related party? business reason?)
- That the composition amount is correct and underskott will be reduced

**Output**: Non-taxable amounts → deduction at **INK2 4.5c**. Composition → note on underskott reduction flowing to module 24.

---

## MODULE 8 — Yield tax, risk tax, and renewable energy ✅

**Feeds in**: `138500` (kapitalförsäkring — endowment insurance BS), `221000` (basis for yield tax BS), `294400` (accrued yield tax on pension BS)

**Tax issue**: Avkastningsskatt (yield tax, lag 1990:661) is a separate tax calculated as:
- **Endowment insurance**: surrender value × statslåneränta (Nov prior year) × 15%
- **Pension foundations**: similar formula at a different rate

The booked yield tax cost is itself **deductible** for corporate income tax purposes. The module verifies the calculation is correct — no add-back if correctly booked, but formula errors are common.

**Riskskatt**: Applies to credit institutions (banks) only. If applicable, basis is reported at INK2 1.3.

**AI task**: Identify the arrangement type from annual report notes. Verify that the booked cost matches the formula using the applicable statslåneränta. Flag if amounts seem inconsistent with the BS balance. Confirm deductibility.

**Renewable energy flag**: If the annual report mentions elcertifikat, ursprungsgarantier, or hydropower production tax (produktionsskatt på vattenkraft) — flag for manual review. Energy certificates are taxable income if booked as such; production taxes are deductible. No automated adjustment — user prompted to verify treatment.

**User verifies**:
- The surrender value / basis used for the yield tax calculation
- The statslåneränta rate applied (Riksgälden published rate, 30 Nov prior year)
- That the booked cost is already in P&L as a deductible expense
- If renewable energy flag triggered: that certificates/production taxes are correctly classified

**Output**: No income adjustment — already correctly in P&L. Populates basis codes:
- Riskskatt: **INK2 1.3** (kreditinstituts underlag för riskskatt) — only if applicable
- Avkastningsskatt 15%: **INK2 1.6a** (försäkringsföretag/avsatt till pensioner), **INK2 1.6b** (utländska pensionsförsäkringar)
- Avkastningsskatt 30%: **INK2 1.7a** (försäkringsföretag), **INK2 1.7b** (utländska kapitalförsäkringar)
- Renewable energy skattereduktion: **INK2 1.16** (förnybar el) if applicable

Flag if overclaimed or misclassified.

---

## MODULE 9 — Group contributions ✅

**Feeds in**: `882000` (koncernbidrag received), `883000` (koncernbidrag provided)

**Tax issue**: Under IL 35:1–3, group contributions are deductible/taxable only when conditions are met: >90% ownership for the entire fiscal year, both parties Swedish, contribution recognized in the same fiscal year, giving company does not create or increase a deficit.

Since group contributions are booked in the P&L they are already included in profit before tax and flow through the FS at **INK2 3.x codes** — no separate 4.x adjustment is needed under normal circumstances. This module is a **validation gate only**.

**AI task**: Confirm that the IL 35 conditions are met based on annual report notes (ownership %, entity jurisdictions, timing). If all conditions are met → no output. If a condition may not be met → flag for user review and propose an add-back for the provided contribution.

**User verifies**:
- Ownership percentage was >90% for the entire fiscal year
- Counterparty is a Swedish company
- Giving company does not create a deficit through the contribution

**Output**: Conditions met → no INK2 adjustment (3.x treatment stands). Conditions not met → provided contribution (883000) added back at relevant 4.x code.

---

## MODULE 10 — Disallowed expenses ✅

**Feeds in**: `607100` (entertainment presumed deductible), `607200` (entertainment presumed non-deductible), `634200` (sanctions/penalties), `655000` (consulting fees), `690000` (other non-deductible costs), `698100` (membership fees presumed deductible), `698200` (membership fees presumed non-deductible), `699300` (sponsorship presumed non-deductible), `762200` (healthcare presumed deductible), `762300` (healthcare presumed non-deductible), `598000` (sponsorship presumed deductible)

**Tax issue** (IL 9:9, 16:2):
- **Sanctions/fines (634200)**: never deductible — full add-back, no exceptions
- **Entertainment**: tax treatment follows account mapping — 607200 (non-deductible) → full add-back; 607100 (deductible) → no adjustment
- **Membership fees**: follows mapping — 698200 → full add-back; 698100 → deductible, no adjustment
- **Sponsorship**: follows mapping — 699300 → full add-back; 598000 → deductible, no adjustment
- **Healthcare**: follows mapping — 762300 → full add-back; 762200 → deductible, no adjustment
- **Consulting fees (655000)**: generally deductible. **Exception**: legal fees specifically related to preparing the company's income tax return are non-deductible (IL 9:2). AI must identify this narrow case only — all other consulting is deductible and must not be flagged.

**AI task**: Apply full add-backs automatically for all non-deductible mapped accounts. For consulting fees (655000): scan annual report and account descriptions specifically for tax return preparation fees — propose add-back only for that narrow case, with explicit reasoning. All other consulting → no action.

**User verifies**:
- That the account mapping (deductible/non-deductible split) correctly reflects the nature of each expense
- Any consulting fee add-back proposed by AI — confirm it relates to income tax return preparation

**Output**: All add-backs → **INK2 4.3c**.

---

## MODULE 11 — Pension costs and basis for special employer's contribution ✅

**Feeds in**: `294300` (accrued löneskatt on pension BS), `740000` (pensionskostnader IS), `753000` (löneskatt på pensionskostnader IS)

**Tax issue**: Employer pension costs are deductible under IL 28, subject to caps:
- **Collective agreement (ITP etc.)**: deductible as incurred — no cap
- **Individual pension insurance premiums**: deductible up to higher of 35% of salary or 10 prisbasbelopp (per individual), max 70% of salary
- **Direktpension**: deductible only when paid out, not when provisioned — unless secured via PRI credit insurance

**Prisbasbelopp limits** (deterministic — app derives from fiscal year):
- FY2025: 10 pbb = SEK 588,000 (pbb SEK 58,800)
- FY2026: 10 pbb = SEK 592,000 (pbb SEK 59,200)
- App must read fiscal year from module 1 and apply the correct limit automatically

**Important limitation**: The IL 28 cap is per individual — the annual report does not contain per-employee pension data. The app cannot automatically verify whether the cap has been exceeded. This is presented as a **disclaimer** to the user: the deduction limit cannot be verified from available data; the user must confirm that individual pension premiums are within the allowable cap.

Special payroll tax (löneskatt, 24.26%): levied on pension costs and itself deductible.

**AI task**: Identify pension arrangement type from annual report notes. Flag if direktpension is present (deductibility timing issue). Verify löneskatt is at 24.26%. For individual pension premiums: display the applicable pbb limit and show the disclaimer.

**User verifies**:
- Pension arrangement type (collective / individual / direktpension)
- For individual premiums: that per-employee amounts are within the IL 28 cap
- That löneskatt percentage is correct for the fiscal year

**Output**: Pension costs → reported as basis for särskild löneskatt at **INK2 1.4** (positive basis) or **INK2 1.5** (negative basis). Also flows to **INK2 4.21**. Non-deductible excess (if user confirms) → add-back.

---

## MODULE 12 — Depreciation on tangible and acquired intangible assets ✅

**Feeds in**: `102000` (BS opening/closing values), `215000` (accelerated depreciation reserve BS), `397000` (booked depreciation IS), `885000` (accelerated depreciation IS)

**Tax issue**: Under IL 18, machinery and equipment (inventarier) can be depreciated at max:
- **30%-metoden**: 30% declining balance on skattemässigt restvärde
- **20%-metoden**: straight-line 20% per year of acquisition value

The difference between booked and tax-allowed depreciation is the key adjustment. The obeskattad reserv (215000) represents cumulative excess tax depreciation taken vs book.

**Tiered AI approach**:

**Tier 1 — Residual value proxy check (automatic)**: Use book carrying value as a proxy for skattemässigt restvärde. If booked depreciation brings carrying value to ≤70% of prior year opening value (adjusted for acquisitions/disposals), the 30%-metoden is satisfied. Output: "likely compliant — no adjustment required."

**Tier 2 — 20%-metoden automation (semi-automatic)**: If the annual report asset note shows acquisition history (typically 4–5 years under K2/K3), AI extracts this and computes the cumulative 20% straight-line deduction. If this covers booked depreciation → confirmed compliant. No prior tax return needed.

**Tier 3 — Manual escalation**: If tiers 1 and 2 both fail to confirm compliance, flag to user that the precise opening skattemässigt restvärde is required. Manual input field provided. Prior tax return upload deferred to V2.

Verify that 215000 moves consistently with 885000. Flag if the company appears to switch method year-over-year.

**User verifies**:
- Acquisitions and disposals during the year are correctly reflected in the asset note
- If tier 3 triggered: enter the opening skattemässigt restvärde from last year's tax return
- Depreciation method is consistent with prior years

**Output**: Tax depreciation > book → additional deduction at **INK2 4.9−**. Tax depreciation < book → add-back at **INK2 4.9+**. Compliant result → no adjustment.

---

## MODULE 13 — Shares and participations ✅

**Feeds in**: `131000` (andelar BS), `801000` (dividends IS), `802000` (capital gain/loss IS)

**Tax issue**: Same näringsbetingade analysis as module 5 but for shares held as **fixed assets**. Classification criteria (IL 24:14, IL 25a):
- **Näringsbetingade andelar**: holding ≥10% of voting rights, OR held for business reasons (not pure investment)
- If näringsbetingad: dividends exempt (IL 24:17), capital gains exempt (IL 25a:5), losses **not** deductible (IL 25a:19)
- If portfolio shares: gains taxable, dividends taxable, losses deductible

**AI task**: Classify each shareholding using annual report notes (subsidiary/associate lists, ownership percentages). For each dividend (801000) and gain/loss (802000): propose exempt or taxable treatment. This module is critical — errors cause significant tax misstatements.

**User verifies**:
- Share classification for each holding
- Whether any holding crossed the 10% threshold during the year
- That gains on näringsbetingade shares are fully excluded (no partial treatment)

**Output**: Exempt dividends → deduction at **INK2 4.5b**. Exempt capital gains → deduction at **INK2 4.7a**. Non-deductible losses on näringsbetingade shares → add-back at **INK2 4.7b**. Taxable portfolio items → remain in base.

---

## MODULE 14 — Partnership interest (Handelsbolag) — N3B ✅

**Feeds in**: Nothing currently routed — by definition the trial balance doesn't capture the partnership's internal tax adjustments

**Tax issue**: Swedish partnerships (HB/KB) are fiscally transparent — the partner company is taxed on its proportional share of partnership income/loss and must declare this via form N3B. The partner's share of the partnership's own tax adjustments also applies at partner level.

**AI/UI approach**: Warning-based + manual entry. AI scans annual report notes for any mention of handelsbolag or kommanditbolag interests. If found, displays a prominent warning.

**User verifies** (guidance text when triggered):
- The company's ownership share (%)
- The partnership's reported net income/loss for the year (from the partnership's own N3B)
- Any tax adjustments at partnership level that need to be reflected at partner level
- Manual entry field for the income/loss share → flows to INK2 N3B section

**Output**: Manual entry → INK2 N3B section. No output if no partnership interest detected and user confirms none exists.

---

## MODULE 15 — Property tax and property fee ✅

**Feeds in**: `251300` (accrued property tax BS), `519100` (property tax/fee IS)

**Tax issue**: Fastighetsskatt (commercial property: 0.5% of taxeringsvärde) and fastighetsavgift (residential: annual capped fee) are both fully deductible (IL 16:1). No restriction applies — the module's purpose is verification only, as errors in calculation and accrual are common.

**AI task**: Verify that the booked IS cost (519100) is consistent with the BS accrual (251300) and the assessed value/property type disclosed in the annual report. Flag if amounts seem inconsistent or the rate doesn't match the property type.

**User verifies**:
- The assessed value (taxeringsvärde) used as the basis
- Property type (commercial vs residential — determines rate vs capped fee)
- That the accrual correctly covers the full fiscal year period

**Output**: No INK2 income adjustment — already correctly in P&L. AI identifies property type and populates the correct basis code:
- Fastighetsavgift: **INK2 1.8** (småhus/ägarlägenhet), **INK2 1.9** (hyreshus, bostäder)
- Fastighetsskatt: **INK2 1.10** (småhus tomtmark/byggnad under uppförande), **INK2 1.11** (hyreshus tomtmark/bostäder under uppförande), **INK2 1.12** (hyreshus lokaler), **INK2 1.13** (industri/värmekraftverk), **INK2 1.14** (vattenkraftverk), **INK2 1.15** (vindkraftverk)

Flag only if overclaimed or property type is ambiguous.

---

## MODULE 16 — Warranty provision ✅

**Feeds in**: `222000` (garantiavsättning BS), `636100` (change in warranty provision IS), `636200` (actual warranty costs IS)

**Tax issue** (IL 16:3–5): Warranty provisions follow a specific deductibility formula — not simply "non-deductible when booked":

**Schablonregeln (IL 16:4) — default method**:
> Max deductible = (warranty months / 24) × actual warranty costs incurred during the year

- 12-month warranty → 50% of actual costs deductible
- 18-month warranty → 75%
- 24-month warranty or more → 100%

If mixed warranty periods exist, costs must be segmented and each tranche proportioned separately. The provision must be **reversed and re-established** each year (IL 16:3).

**Utredningsregeln (IL 16:5)**: A higher deduction may be claimed in special circumstances (new business, very large individual projects, significant volume change, warranty period >24 months). Rarely applicable — requires documented justification.

**AI task**: Extract warranty period(s) from annual report notes. Identify actual warranty costs incurred (636200) and the net provision movement (636100). Apply the schablonregel formula to compute the maximum deductible amount. Compare to booked provision. Flag if the booked provision exceeds the formula ceiling. Check for any utredningsregel indicators in the annual report.

**User verifies**:
- Warranty period(s) extracted from annual report are correct
- Actual warranty costs (636200) are correctly separated from provision movements (636100)
- Whether utredningsregel special circumstances apply

**Output**:
- Excess provision above formula ceiling → add-back at **INK2 4.3c**
- Reversal of prior year's disallowed excess → deduction at **INK2 4.5c**

---

## MODULE 17 — Schablonintäkt på periodiseringsfond ✅

**Feeds in**: Outstanding periodiseringsfonder table from module 1 (year of allocation + amount), statslåneränta for the fiscal year (deterministic lookup)

**Note**: This module handles the schablonintäkt calculation only. Reversals (återföring) are handled in module 25. New allocations (avsättning) are handled in module 28.

**Tax issue** (IL 30:6a): Each year, a notional yield charge is levied on the sum of all outstanding periodiseringsfonder regardless of whether any reversal or new allocation is made:
> Schablonintäkt = sum of all outstanding funds × statslåneränta (30 Nov prior year) × 72%

**Statslåneränta**: Maintained as a deterministic lookup table keyed to fiscal year — app applies the correct rate automatically based on fiscal year from module 1.

**AI task**: None — fully deterministic.

**User verifies**:
- That the outstanding periodiseringsfonder table in module 1 is complete and correct (this is the only manual input)

**Output**: Schablonintäkt → taxable addition at **INK2 4.6a**. Feeds into the final tax calculation chain.

---

## MODULE 18 — Inkuransreserv för lager ✅

**Feeds in**: `14XX` (inventory BS accounts), `49XX` (change in inventory / write-downs IS)

**Tax issue** (IL 17:4): For tax purposes, inventory may be valued at the lower of 97% of total acquisition cost (FIFO) or net realizable value. The 3% inkuransavdrag is the maximum allowable obsolescence reserve:

- Booked obsolescence reserve ≤ 3% of inventory cost → fully deductible, no adjustment
- Booked obsolescence reserve > 3% of inventory cost → excess is non-deductible → add-back
- Prior year excess being reversed in current year → previously non-deductible amount now released → deduction

**AI task**: Extract closing inventory value from BS (14XX) and the booked inkuransreserv. Compute 3% of inventory cost. Compare to booked reserve. Calculate any excess add-back. Identify if prior year's disallowed excess is being reversed this year.

**User verifies**:
- That the inventory cost basis used is correct (FIFO)
- That the booked obsolescence reserve is correctly identified from the annual report notes
- Whether any specific write-downs beyond the standard reserve exist

**Output**:
- Excess reserve above 3% → add-back at **INK2 4.3c**
- Reversal of prior year's disallowed excess → deduction at **INK2 4.5c**

---

## MODULE 19 — Shares and participations — average method ✅

**Feeds in**: `133X` (portfolio shares BS), `802X` (capital gains/losses IS)

**Tax issue** (IL 48:7): When portfolio shares (non-näringsbetingade) are sold, the acquisition cost is determined using the **genomsnittsmetoden** (average cost method) — the average cost of all shares of the same class held by the company. The booked gain/loss may differ from the tax gain/loss if the average cost differs from the book cost.

**AI task**: Identify any portfolio share disposals from annual report notes. Extract proceeds and booked carrying value. Flag that the tax acquisition cost may differ from the book cost and that genomsnittsmetoden must be applied.

**User verifies**:
- That shares are correctly classified as portfolio (non-näringsbetingade) — if näringsbetingade, refer to module 13
- The average acquisition cost per share under genomsnittsmetoden (manual input — requires acquisition history)
- The resulting taxable gain/loss vs booked gain/loss — enter any difference as an adjustment

**Output**:
- Tax gain > book gain → addition at **INK2 4.3c**
- Tax gain < book gain (or tax loss > book loss) → deduction at **INK2 4.5c**

---

## MODULE 20 — Items not included in the books ✅

**Feeds in**: Nothing from trial balance — by definition these items are absent from the accounts

**Tax issue**: Under IL 14:2, taxable income includes all income even if not booked. Common examples: benefits in kind not declared, owner withdrawals of goods/services at below-market value (uttag, IL 22), forgiven intra-group debt that should be income, barter transactions.

**AI/UI approach**: Warning-based + manual entry. AI scans annual report notes and related-party disclosures for any mention of transactions not at arm's length, owner-related transactions, or auditor comments about unrecorded items. Flag anything suspicious.

**User guidance text displayed in UI**:
> *"Review whether any taxable transactions occurred during the year that are not reflected in the accounts. Common examples include owner withdrawals at below-market value (uttag), private expenses paid by the company, benefits in kind not reported on salary statements, forgiven intra-group debt, and barter transactions. Enter any such amounts manually below."*

**User verifies**:
- Goods or services withdrawn from the company for private use (IL 22 uttag — taxable at market value)
- Employee benefits not reported on kontrolluppgifter
- Debts forgiven by a related party that should be treated as income
- Any barter transactions or non-cash income not reflected in revenue

**Output**: Manual additions → **INK2 4.3c** or appropriate code depending on item type.

---

## MODULE 21 — Hybrid and targeted interest limitation rules, and offsetting of net interest ✅

**Feeds in**: `830X`/`831X` (interest income IS), `832X`/`833X` (interest expense IS), EBITDA flowing from module 2 (profit before tax) and module 12 (depreciation/amortization)

**Note**: N9 form generation is deferred to V2.

**Tax issue** (IL 24:21–29): Sweden's interest deduction limitation rules apply in two layers:

**Layer 1 — Targeted rules (riktade regler)**: Certain interest expenses are always disallowed regardless of EBITDA:
- Interest on loans between group companies where the arrangement is primarily tax-motivated
- Interest on loans financing intra-group acquisitions of shares (unless commercially justified)
- Hybrid instruments where the counterparty doesn't recognize corresponding income

**Layer 2 — General EBITDA rule (generell regel)**: Net interest expense exceeding 30% of EBITDA is non-deductible:
> Deductible net interest = min(net interest expense, 30% × EBITDA)

**Simplified EBITDA calculation** (V1):
> EBITDA = Profit before tax (from module 2) + net interest expense + depreciation/amortization (from module 12)

**Negative net interest** (net interest income): fully taxable, no limitation applies — flows directly to the calculation chain.

**AI task**: Identify net interest position. Apply 30% EBITDA ceiling. Flag any group loans or acquisition financing for targeted rule review.

**User verifies**:
- That EBITDA inputs (profit before tax, depreciation, net interest) are correct
- Whether any loans trigger the targeted rules (group loans, acquisition financing, hybrids)
- The final deductible vs non-deductible net interest split

**Output**: Non-deductible excess interest → add-back at **INK2 4.3c**. Deductible net interest and negative net interest → flow to downstream modules 26 and 23.

---

## MODULE 22 — Tax calculation before deduction of prior-year losses and negative net interest ✅

**Type**: Deterministic checkpoint — no AI

**Purpose**: First aggregation point in the calculation chain. Collects all adjustments from modules 1–21 and computes an intermediate taxable income figure.

**Inputs flowing in**:
- Profit before tax (module 2)
- All add-backs from modules 3–21 (4.3c, 4.6a, 4.7b etc.)
- All deductions from modules 3–21 (4.5b, 4.5c, 4.7a, 4.9− etc.)

**Calculation**:
> Taxable income (pre-losses) = Profit before tax + all add-backs − all deductions

**UI shows**:
- Itemized list of every adjustment flowing in, grouped by INK2 code
- Running subtotal
- Final intermediate taxable income figure
- Warning if result is negative at this stage

**Output**: Intermediate taxable income → feeds module 23.

---

## MODULE 23 — Tax calculation after deduction for negative net interest and tax losses carried forward ✅

**Type**: Deterministic checkpoint — no AI

**Purpose**: Second aggregation point. Takes the intermediate taxable income from module 22 and applies negative net interest and prior-year tax losses.

**Inputs flowing in**:
- Intermediate taxable income from module 22
- Deductible net interest / negative net interest position from module 21
- Tax losses carried forward (underskott) from module 24

**Calculation**:
> Taxable income (post-losses) = Module 22 result − negative net interest − utilized underskott

**Rules on underskott utilization**:
- Cannot reduce taxable income below zero (unused underskott carried forward to next year)
- If ownership change occurred (flagged in module 1) → underskottsspärr may restrict utilization — display warning

**UI shows**:
- Module 22 subtotal
- Negative net interest deduction line
- Underskott utilized this year
- Remaining underskott carried forward
- Ownership change warning if applicable
- Final taxable income after losses

**Output**: Taxable income after losses → feeds module 25 (periodiseringsfond reversal) and module 29.

---

## MODULE 24 — Tax losses carried forward ✅

**Type**: Mostly deterministic with AI-assisted pre-fill

**Feeds in**: Underskott table from module 1, result from module 22, ownership change flag from module 1, `taxDeep.relevantNotes` (deferred_tax_loss_carryforwards category) from annual report extraction

**Tax issue** (IL 40):
- Underskott carry forward indefinitely — no time limit in Sweden
- **Underskottsspärr** (IL 40:10): If >50% ownership change occurred, utilization is restricted for 5 years to the acquisition price of the shares (beloppsspärr)
- **Koncernbidragsspärr** (IL 40:18): After ownership change, underskott can only be offset against income from the same business — group contributions cannot be used to exploit acquired losses for 5 years

**AI task**: Read the annual report's deferred tax notes (deferred_tax_loss_carryforwards category). Attempt to pre-populate the underskott register — extract total amount and year-by-year breakdown if disclosed. Flag if the disclosed deferred tax asset on underskott appears inconsistent with the register entered in module 1. Flag if annual report mentions any TLCF restriction due to ownership change.

**Note**: Annual reports typically only show total underskott or the deferred tax asset at 20.6% — year-by-year breakdown usually requires the prior tax return. AI pre-fills what it can and flags gaps for user to complete.

**User verifies**:
- That the prior-year underskott register is complete and correct
- Whether an ownership change occurred and the acquisition price (required for beloppsspärr calculation)
- That any ackord (debt forgiveness from module 7) has reduced the underskott register accordingly
- AI-extracted underskott amount vs module 1 register — resolve any discrepancy

**Output**: Utilizable underskott → feeds module 23. Remaining carry-forward → updated register for next year.

---

## MODULE 25 — Reversal of tax allocation reserve (återföring av periodiseringsfond) ✅

**Type**: Deterministic with guided UI — no AI

**Purpose**: Handles mandatory and voluntary reversals of periodiseringsfonder. This is the second of the three periodiseringsfond modules.

**Inputs flowing in**:
- Outstanding periodiseringsfonder register from module 1 (year of allocation + amount)
- Taxable income from module 23

**Rules** (IL 30):
- Any fund allocated in year Y **must** be reversed by year Y+6 at the latest
- Voluntary early reversal is always permitted
- Reversal increases taxable income in the year of reversal

**UI shows**:
- Full register of outstanding funds with age and mandatory reversal deadline
- Mandatory reversals pre-ticked (year 6 funds)
- Optional voluntary reversal checkboxes for remaining funds
- Impact on taxable income for each selection

**User verifies**:
- That mandatory reversals are correct
- Whether voluntary reversals are beneficial given the current year income position

**Output**: Total reversal amount → taxable addition flowing into module 29. Updated register (remaining funds) → carried forward to next year.

---

## MODULE 26 — Deductible net interest under the general interest deduction limitation rule ✅

**Type**: Deterministic pass-through — no AI

**Purpose**: Applies the deductible net interest figure computed in module 21 at the correct point in the calculation chain.

**Inputs flowing in**:
- Deductible net interest / negative net interest from module 21
- Taxable income position from module 23

**Rules** (IL 24:21–29):
- Net interest income (negative net interest): fully taxable, already in profit before tax, no further deduction
- Net interest expense: deductible portion (≤30% EBITDA from module 21) reduces taxable income here
- Non-deductible excess was already added back in module 21 at 4.3c

**UI shows**:
- Net interest position (income or expense)
- Deductible amount confirmed from module 21
- Non-deductible amount already added back (reference to module 21)
- Updated taxable income after applying deductible net interest

**Output**: Adjusted taxable income → feeds module 27 and module 29.

---

## MODULE 27 — Increased deduction for restricted tax losses carried forward (TLCF) ✅

**Type**: Guided UI — edge case, no AI

**Purpose**: Handles the specific situation where underskott subject to beloppsspärr (from module 24) can be utilized within the restriction ceiling.

**Inputs flowing in**:
- Restricted underskott register and beloppsspärr ceiling from module 24
- Taxable income from module 26
- Ownership change acquisition price from module 24

**Rules** (IL 40:10–15):
- After an ownership change, restricted losses may only be utilized up to the acquisition price of the shares (beloppsspärren) spread over 5 years
- After 5 years from the ownership change the restriction lifts and full utilization resumes
- Unused annual ceiling is lost — cannot be carried forward

**UI shows**:
- Whether beloppsspärr applies (flagged from module 24)
- Remaining restriction ceiling for current year
- Maximum utilizable restricted underskott this year
- Years remaining until restriction lifts
- Warning if ceiling will be wasted (taxable income lower than ceiling)

**User verifies**:
- Acquisition price used for beloppsspärr calculation
- Year of ownership change (determines when 5-year restriction ends)

**Output**: Utilized restricted underskott → deduction feeding into module 29. Remaining restricted underskott → updated register.

---

## MODULE 28 — Allocation to tax allocation reserve (avsättning till periodiseringsfond) ✅

**Type**: Deterministic with guided UI — user decision, no AI

**Purpose**: Final of the three periodiseringsfond modules. New allocation decision is made here — at the end of the chain once taxable income is known.

**Inputs flowing in**:
- Taxable income after all deductions from modules 23–27
- Outstanding periodiseringsfonder register

**Rules** (IL 30):
- Maximum new allocation = 25% of taxable income at this point in the chain
- Cannot allocate if taxable income is zero or negative
- New allocation reduces taxable income for the current year

**UI shows**:
- Current taxable income before allocation
- Maximum allowable allocation (25%)
- Input field for desired allocation amount (defaults to maximum)
- Impact on taxable income and current year tax
- Updated periodiseringsfond register including new fund

**User verifies**:
- Whether to make an allocation and at what amount (strategic decision)
- That the new fund is correctly added to the register for future years

**Output**: Allocation amount → deduction feeding into module 29. Updated register → carried forward.

---

## MODULE 29 — Tax calculation after deduction for negative net interest, tax allocation reserve, and tax losses ✅

**Type**: Deterministic checkpoint — no AI

**Purpose**: Third and final aggregation point in the calculation chain. Consolidates all deductions applied in modules 23–28 into a single updated taxable income figure before final tax calculation.

**Inputs flowing in**:
- Taxable income from module 23
- Deductible net interest from module 26
- Utilized restricted TLCF from module 27
- Periodiseringsfond reversal (addition) from module 25
- Periodiseringsfond new allocation (deduction) from module 28

**Calculation**:
> Taxable income (final) = Module 23 result + periodiseringsfond reversal − deductible net interest − utilized restricted TLCF − new periodiseringsfond allocation

**UI shows**:
- Waterfall view of each adjustment applied since module 22
- Subtotal at each step
- Final taxable income before tax rate application
- Warning if result is negative (should not occur at this stage — flag for review)

**Output**: Final taxable income → feeds module 30.

---

## MODULE 30 — Final tax calculation ✅

**Type**: Deterministic — no AI

**Purpose**: Applies the corporate tax rate to the final taxable income and produces the definitive tax charge. This is the **only module that writes to INK2 4.x codes** — all upstream adjustments converge here before flowing to the INK2 renderer.

**Inputs flowing in**:
- Final taxable income from module 29
- Property tax bases from module 15 (1.8–1.16)
- Pension cost basis from module 11 (1.4, 1.5)
- Yield/risk tax bases from module 8 (1.3, 1.6a, 1.6b, 1.7a, 1.7b)
- Renewable energy tax reduction from module 8 (1.16)

**Calculations**:
> Corporate income tax = taxable income × 20.6%
> Särskild löneskatt = pension basis (1.4) × 24.26%
> Avkastningsskatt = yield tax basis × applicable rate (15% or 30%)
> Fastighetsskatt/avgift = property bases × applicable rates
> Riskskatt = credit institution basis (1.3) × applicable rate (if applicable)

**UI shows**:
- Full waterfall from profit before tax (module 2) to final taxable income (module 29)
- Each tax base and its rate
- Itemized tax charges for each tax type
- Total tax charge
- Effective tax rate (total tax / profit before tax) — sanity check
- Comparison to booked tax expense from annual report (module 2) — flag significant differences

**User verifies**:
- That the effective tax rate is reasonable (~20.6% for a straightforward company)
- Any significant deviation from booked tax expense
- All tax bases are correctly populated

**Output**: All figures → INK2 module (pure renderer). Tax charge → feeds module 4 (INK2) for PDF export.
