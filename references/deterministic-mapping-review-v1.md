# Deterministic Mapping Review V1

Generated from code at 2026-03-02T22:11:12.860Z.

Source files:
- src/shared/contracts/mapping.v1.ts
- src/server/mapping/deterministic-mapping.v1.ts

Legend:
- BAS number rules:
  - `=6072` means exact account number match.
  - `6072*` means prefix match (all accounts beginning with 6072).
- Coverage:
  - "Dedicated deterministic rule(s)" means there is explicit rule logic for the category.
  - "Fallback only" means no explicit category-specific rule yet; mapping falls back by statement type.

## Balance Sheet Categories

| Silverfin Category | Silverfin Code | BAS Account Number Rules | Name/Description Keyword Triggers | Rule IDs | Coverage |
| --- | --- | --- | --- | --- | --- |
| Non-tax sensitive - Balance | 100000 | Prefixes: 1119*, 1159*, 1239*, 113*, 114*, 147*, 148* | balanserad utgift, aktiverad utgift, capitalized expenditure, ackumulerad avskrivning byggnad, ack avskrivning byggnad, ackumulerad avskrivning markanlaggning, ackumulerad avskrivning markanläggning, ackumulerad avskrivning leasehold, ackumulerad avskrivning hyrd lokal, accumulated depreciation building, accumulated depreciation land improvement, mark, land, tomt, pagaende projekt, pågående projekt, pagaende arbete, pågående arbete, wip, work in progress, koncernbidrag, group contribution, fordran, receivable | map.bs.non-tax-sensitive.capitalized-expenditure.v1, map.bs.non-tax-sensitive.accumulated-depr-building-land-leasehold.v1, map.bs.non-tax-sensitive.land.v1, map.bs.non-tax-sensitive.wip.v1, map.bs.non-tax-sensitive.group-contribution-receivable.v1 | Dedicated deterministic rule(s) |
| Tangible and acquired intangible assets - opening/closing balance | 102000 | Prefixes: 10*, 11*, 12* | anlaggningstillgang, immateriell, materiell, fixed asset, anläggningstillgång, ackumulerad avskrivning, accumulated depreciation | map.bs.tangible-intangible-opening-closing.v1 | Dedicated deterministic rule(s) |
| Buildings - Acquisition value | 111000 | Prefixes: 111* | byggnad, building, byggnader | map.bs.buildings.acquisition.v1 | Dedicated deterministic rule(s) |
| Land improvements - Acquisition value | 115000 | Prefixes: 115* | markanlaggning, land improvement, markanläggning | map.bs.land-improvements.acquisition.v1 | Dedicated deterministic rule(s) |
| Leaseholder's improvements - Acquisition value | 123200 | Prefixes: 1232* | forbattringsutgift, leasehold, hyrd lokal, leaseholder, förbättringsutgift | map.bs.leaseholder-improvements.acquisition.v1 | Dedicated deterministic rule(s) |
| Shares and shareholdings - General balance sheet item | 131000 | Prefixes: 131*, 132*, 133* | aktier, shares, andelar, shareholding | map.bs.shares.general.v1 | Dedicated deterministic rule(s) |
| Change in value and write-downs on capital assets - General balance sheet item | 138400 | Prefixes: 1384* | nedskrivning, uppskrivning, value change, write down, capital asset, koncernintern fordran, koncernfordran, intercompany receivable, intra group receivable, intra-group receivable, impairment | map.bs.capital-asset-value-changes.v1, map.bs.capital-asset-value-changes.intra-group-impairment-signal.v1 | Dedicated deterministic rule(s) |
| Endowment insurance | 138500 | Prefixes: 1385* | kapitalforsakring, endowment, insurance, kapitalförsäkring | map.bs.endowment-insurance.v1 | Dedicated deterministic rule(s) |
| Inventory - Acquisition value | 141000 | Prefixes: 14* | lager, inventory, varulager | map.bs.inventory.acquisition.v1 | Dedicated deterministic rule(s) |
| Inventory - Obsolescence reserve | 141900 | Prefixes: 1419*, 149* | inkurans, obsolescence, lagerreserv, reserve | map.bs.inventory.obsolescence-reserve.v1 | Dedicated deterministic rule(s) |
| Doubtful debts | 151500 | Prefixes: 1515*, 1518*, 1519* | osakra kundfordringar, doubtful debt, bad debt, osäkra kundfordringar, tvistiga kundfordringar, dubious receivables, kundfordringar omvardering, kundfordringar omvärdering | map.bs.doubtful-debts.v1 | Dedicated deterministic rule(s) |
| Tax allocation reserve | 211000 | Prefixes: 211* | periodiseringsfond, tax allocation reserve | map.bs.tax-allocation-reserve.v1 | Dedicated deterministic rule(s) |
| Accelerated depreciation - tangible/acquired intangible assets | 215000 | Prefixes: 215* | overavskrivning, accelerated depreciation, överavskrivning | map.bs.accelerated-depreciation.v1 | Dedicated deterministic rule(s) |
| Basis for yield tax | 221000 | Prefixes: 221* | avkastningsskatt, yield tax | map.bs.yield-tax-basis.v1 | Dedicated deterministic rule(s) |
| Warranty provision | 222000 | Prefixes: 222* | garanti, warranty, avsattning, avsättning | map.bs.warranty-provision.v1 | Dedicated deterministic rule(s) |
| Other provisions | 229000 | Prefixes: 229* | avsattning, avsättning, provision, reservering, reservation, upplupen, accrued | map.bs.other-provisions.v1 | Dedicated deterministic rule(s) |
| Property tax and property fee | 251300 | Exact: =2513 | Prefixes: 2513* | fastighetsskatt, fastighetsavgift, property tax, upplupen, accrued | map.bs.property-tax-fee.v1 | Dedicated deterministic rule(s) |
| Accrued special payroll tax on pension | 294300 | Prefixes: 2943* | sarskild loneskatt, special payroll tax, pension, upplupen, accrued, reservering, avsattning, avsättning, innevarande ar, innevarande år | map.bs.accrued-special-payroll-tax-pension.v1 | Dedicated deterministic rule(s) |
| Accrued yield tax on pension | 294400 | Prefixes: 2944* | avkastningsskatt, yield tax, pension | map.bs.accrued-yield-tax-pension.v1 | Dedicated deterministic rule(s) |

## Income Statement Categories

| Silverfin Category | Silverfin Code | BAS Account Number Rules | Name/Description Keyword Triggers | Rule IDs | Coverage |
| --- | --- | --- | --- | --- | --- |
| Financial inventory assets - Capital gain/loss | 367000 | Prefixes: 3670*, 3671* | financial inventory, capital gain, capital loss | map.is.financial-inventory.capital-gain-loss.v1 | Dedicated deterministic rule(s) |
| Financial inventory assets - dividend | 367200 | Prefixes: 3672* | utdelning, dividend, financial inventory | map.is.financial-inventory.dividend.v1 | Dedicated deterministic rule(s) |
| Change in value and write-downs on capital assets | 394000 | Prefixes: 394* | nedskrivning, uppskrivning, value change, write down, capital asset | map.is.capital-assets.value-change-write-down.v1 | Dedicated deterministic rule(s) |
| Tangible/acquired intangible assets - booked depreciation | 397000 | Prefixes: 781*, 783*, 785*, 786*, 787*, 788* | avskrivning, depreciation, anlaggningstillgang | map.is.tangible-intangible.depreciation.v1 | Dedicated deterministic rule(s) |
| Buildings and land - capital gain | 397200 | Prefixes: 3972* | reavinst, capital gain, byggnad, fastighet, mark | map.is.buildings-land.capital-gain.v1 | Dedicated deterministic rule(s) |
| Received gifts and donations - non-taxable | 399300 | Prefixes: 3993* | gava, donation, non taxable, gåva | map.is.gifts-donations.non-taxable.v1 | Dedicated deterministic rule(s) |
| Composition agreement - non-taxable | 399500 | Prefixes: 3995* | ackord, composition agreement, ackordsvinst | map.is.composition-agreement.non-taxable.v1 | Dedicated deterministic rule(s) |
| Property tax and property fee | 519100 | Prefixes: 5191* | fastighetsskatt, fastighetsavgift, property tax | map.is.property-tax-fee.v1 | Dedicated deterministic rule(s) |
| Interest - financial leasing - income | 521200 | Prefixes: 5212* | financial leasing, leasing, ranteintakt, ränteintäkt | map.is.interest.financial-leasing-income.v1 | Dedicated deterministic rule(s) |
| Interest - financial leasing - cost | 522200 | Prefixes: 5222* | financial leasing, leasing, rantekostnad, räntekostnad | map.is.interest.financial-leasing-cost.v1 | Dedicated deterministic rule(s) |
| Sponsorship, donations and gifts - presumed deductible | 598000 | Prefixes: 598* | sponsring, sponsorship, donation, avdragsgill, julgava, julgåva, personalgava, personalgåva, julklapp, personal, staff, employee, blommor, flowers | map.is.sponsorship-gifts.deductible.v1 | Dedicated deterministic rule(s) |
| Entertainment - internal and external - presumed deductible | 607100 | Prefixes: 6071* | representation, internal, external, intern, extern, avdragsgill | map.is.entertainment.deductible.v1 | Dedicated deterministic rule(s) |
| Entertainment - internal and external - presumed non-deductible | 607200 | Prefixes: 6072*, 607* | representation, internal, external, intern, extern, delvis avdragsgill, partially deductible, partiellt avdragsgill, ej avdragsgill, icke avdragsgill, non deductible | map.is.entertainment.non-deductible.v1 | Dedicated deterministic rule(s) |
| Sanctions and penalties | 634200 | Prefixes: 6342*, 6992* | boter, vite, sanction, penalty, böter | map.is.sanctions-penalties.v1 | Dedicated deterministic rule(s) |
| Warranty provision - Change in warranty provision | 636100 | Prefixes: 6361* | garanti, warranty, avsattning, change | map.is.warranty.change-provision.v1 | Dedicated deterministic rule(s) |
| Warranty provision - Actual costs | 636200 | Prefixes: 6362* | garanti, warranty, kostnad, actual cost | map.is.warranty.actual-costs.v1 | Dedicated deterministic rule(s) |
| Consulting fees | 655000 | Prefixes: 655*, 654* | konsult, consulting, advisory, legal, tax assistance, tax return, deklaration, ink2, skatteradgivning, skatterådgivning | map.is.consulting-fees.v1 | Dedicated deterministic rule(s) |
| Interest - Banking costs | 657000 | Prefixes: 657* | bankkostnad, banking cost, bankavgift | map.is.interest.banking-costs.v1 | Dedicated deterministic rule(s) |
| Other non-deductible costs | 690000 | Prefixes: 690*, 6990*, 6999* | ej avdragsgill, icke avdragsgill, non deductible | map.is.other-non-deductible-costs.v1 | Dedicated deterministic rule(s) |
| Membership fees - presumed deductible | 698100 | Prefixes: 6981* | medlemsavgift, membership fee, avdragsgill, konflikt, arbetsgivarorganisation, employers association, conflict purpose | map.is.membership-fees.deductible.v1 | Dedicated deterministic rule(s) |
| Membership fees - presumed non-deductible | 698200 | Prefixes: 6982* | medlemsavgift, membership fee, medlemskap, membership, ej avdragsgill, icke avdragsgill, non deductible | map.is.membership-fees.non-deductible.v1 | Dedicated deterministic rule(s) |
| Sponsorship, donations and gifts - presumed non-deductible | 699300 | Prefixes: 6993* | sponsring, sponsorship, donation, gava, gåva, gift, ej avdragsgill, icke avdragsgill, non deductible | map.is.sponsorship-gifts.non-deductible.v1 | Dedicated deterministic rule(s) |
| Pension costs and basis for special payroll tax on pension cost | 740000 | Prefixes: 740*, 741*, 742*, 743*, 744* | pension, pensionskostnad | map.is.pension-costs-basis.v1 | Dedicated deterministic rule(s) |
| Special payroll tax on pension cost | 753000 | Prefixes: 753* | sarskild loneskatt, special payroll tax, pension | map.is.special-payroll-tax-pension.v1 | Dedicated deterministic rule(s) |
| Health care - presumed deductible | 762200 | Prefixes: 7622* | sjukvard, health care, avdragsgill, sjukvård | map.is.health-care.deductible.v1 | Dedicated deterministic rule(s) |
| Health care - presumed non-deductible | 762300 | Prefixes: 7623* | sjukvard, health care, ej avdragsgill, icke avdragsgill, non deductible, sjukvård | map.is.health-care.non-deductible.v1 | Dedicated deterministic rule(s) |
| Buildings - booked depreciation | 777000 | Prefixes: 777* | byggnad, building, avskrivning, depreciation | map.is.buildings.booked-depreciation.v1 | Dedicated deterministic rule(s) |
| Land improvement - booked depreciation | 782400 | Prefixes: 7824* | markanlaggning, land improvement, avskrivning, markanläggning | map.is.land-improvement.booked-depreciation.v1 | Dedicated deterministic rule(s) |
| Leaseholder's improvements - booked depreciation | 784000 | Prefixes: 7840* | forbattringsutgift, hyrd lokal, leasehold, avskrivning, förbättringsutgift | map.is.leaseholder-improvements.booked-depreciation.v1 | Dedicated deterministic rule(s) |
| Buildings and land - capital loss | 797200 | Prefixes: 7972* | reaforlust, capital loss, byggnad, fastighet, mark, reaförlust | map.is.buildings-land.capital-loss.v1 | Dedicated deterministic rule(s) |
| Capital assets (Shares) - Dividend | 801000 | Prefixes: 801* | aktieutdelning, dividend, shares | map.is.capital-assets-shares.dividend.v1 | Dedicated deterministic rule(s) |
| Capital assets (Shares) - Capital gain/loss | 802000 | Prefixes: 802* | aktier, shares, capital gain, capital loss, reavinst, reaforlust | map.is.capital-assets-shares.capital-gain-loss.v1 | Dedicated deterministic rule(s) |
| Capital assets (Shares) - Unrealized change in value | 808000 | Prefixes: 808* | orealiserad, unrealized, value change, aktier | map.is.capital-assets-shares.unrealized-value-change.v1 | Dedicated deterministic rule(s) |
| Interest - interest income | 831000 | Prefixes: 831* | ranteintakt, interest income, ränteintäkt | map.is.interest.income.v1 | Dedicated deterministic rule(s) |
| Interest income on the tax account | 831400 | Prefixes: 8314* | skattekonto, interest income, ranteintakt, ränteintäkt, tax exempt, skattefri | map.is.interest.income-tax-account.v1 | Dedicated deterministic rule(s) |
| Interest cost on the tax account | 842300 | Prefixes: 8423* | skattekonto, rantekostnad, interest cost, räntekostnad, ej avdragsgill, icke avdragsgill, non deductible | map.is.interest.cost-tax-account.v1 | Dedicated deterministic rule(s) |
| Interest - FX-gain | 843100 | Prefixes: 8431* | valutakursvinst, fx gain, exchange gain | map.is.interest.fx-gain.v1 | Dedicated deterministic rule(s) |
| Interest - FX-loss | 843600 | Prefixes: 8436* | valutakursforlust, fx loss, exchange loss, valutakursförlust | map.is.interest.fx-loss.v1 | Dedicated deterministic rule(s) |
| Interest - Interest cost | 849000 | Prefixes: 84*, 849* | rantekostnad, interest cost, räntekostnad | map.is.interest.cost.v1 | Dedicated deterministic rule(s) |
| Tax allocation reserve - this year's change | 881000 | Prefixes: 881* | periodiseringsfond, forandring, change, förändring | map.is.tax-allocation-reserve.year-change.v1 | Dedicated deterministic rule(s) |
| Tax allocation reserve - allocation | 881100 | Prefixes: 8811* | periodiseringsfond, allocation, avsattning | map.is.tax-allocation-reserve.allocation.v1 | Dedicated deterministic rule(s) |
| Tax allocation reserve - reversal | 881900 | Prefixes: 8819* | periodiseringsfond, reversal, aterforing, återföring | map.is.tax-allocation-reserve.reversal.v1 | Dedicated deterministic rule(s) |
| Group contribution - received | 882000 | Prefixes: 882* | koncernbidrag, group contribution, received, mottaget | map.is.group-contribution.received.v1 | Dedicated deterministic rule(s) |
| Group contribution - provided | 883000 | Prefixes: 883* | koncernbidrag, group contribution, provided, lamnat, lämnat | map.is.group-contribution.provided.v1 | Dedicated deterministic rule(s) |
| Accelerated depreciation - tangible/acquired intangible assets | 885000 | Prefixes: 885* | overavskrivning, accelerated depreciation, överavskrivning | map.is.accelerated-depreciation.v1 | Dedicated deterministic rule(s) |
| Tax cost | 891000 | Prefixes: 891* | skatt, tax cost, tax expense | map.is.tax-cost.v1 | Dedicated deterministic rule(s) |
| Result of the year | 940000 | Prefixes: 8999*, 8990*, 9400* | arets resultat, result of the year, årets resultat | map.is.result-of-year.v1 | Dedicated deterministic rule(s) |
| Non-tax sensitive - Profit and loss statement | 950000 | Prefixes: 654*, 655* | cogs, cost of goods sold, kostnad salda varor, kostnad sålda varor, forsaljningskostnad avskrivning, försäljningskostnad avskrivning, kostn avskrivn kostnad salda varor, kostn avskrivn kostnad sålda varor, underhall byggnad, underhåll byggnad, building maintenance, reparation byggnad, repair building, fastighetsskotsel, fastighetsskötsel, it konsult, it consulting, it support, software consulting, systemutveckling, hosting, drift, implementation, arbetsgivaravgift, arbetsgivaravgifter, sociala avgifter, social contributions, social fees, lon, lön, salary, wages, personalkostnad, personalfest, staff catering, personalmaltid, personalmåltid, employee meal, kickoff, julbord | map.is.non-tax-sensitive.cogs.v1, map.is.non-tax-sensitive.building-maintenance.v1, map.is.non-tax-sensitive.it-consulting.v1, map.is.non-tax-sensitive.social-contributions.v1, map.is.non-tax-sensitive.salary-generic.v1, map.is.non-tax-sensitive.staff-catering-events.v1 | Dedicated deterministic rule(s) |
