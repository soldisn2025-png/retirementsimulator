import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const STORAGE_KEY = "retiresim-v1";
const MONEY_FONT = "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const BODY_FONT = "'DM Sans', system-ui, sans-serif";
const COLORS = {
  bg: "#F0F4F8",
  header: "#1A2332",
  card: "#FFFFFF",
  text: "#172033",
  muted: "#64748B",
  border: "#D9E2EC",
  bucketA: "#2563EB",
  bucketB: "#7C3AED",
  bucketC: "#059669",
  warn: "#DC2626",
  amber: "#D97706",
};

const INITIAL_STATE = {
  profile: {
    name: "",
    currentAge: 41,
    spouseAge: 41,
    targetRetireAge: 55,
    planToAge: 90,
    familyJoinAge: 65,
  },
  assets: {
    cash: 0,
    taxable: 0,
    rothSelf: 0,
    rothBasis: 0,
    rothSpouse: 0,
    rothSpouseBasis: 0,
    k401: 0,
    rolloverIRA: 0,
    hsa: 0,
    homeValue: 0,
    mortgage: 0,
  },
  income: {
    employmentType: "W2",
    annualGross: 0,
    salaryGrowthPct: 2.5,
    k401Annual: 0,
    employerMatchPct: 3,
    hsaAnnual: 0,
    healthPremium: 3600,
    estimatedTax: 15000,
    wbYearsService: 0,
    wbSEtaxBurdenPct: 7.25,
    wbPensionEmpPct: 5,
    wbPensionWBPct: 10,
    wbTaxAllowance: true,
    seSelfTaxPct: 15.3,
    spouseActive: true,
    spouseAnnual: 0,
    airbnb: 0,
    otherAnnual: 0,
    ssEstimatedAt62: 0,
    ssClaimAge: 67,
    homeSaleAge: 65,
    koreaSoloMonthly: 2000,
    koreaFamilyMonthly: 5000,
  },
  assumptions: {
    returnRatePct: 6,
    inflationPct: 3,
    homeAppreciationPct: 3,
  },
  scenarios: {
    A: {
      active: true,
      name: "Current Job",
      color: "#2563EB",
      retireAge: 50,
      annualFinancialSavings: 62300,
      wbPensionEligible: false,
      wbPensionMonthly: 0,
      ssClaimAge: 67,
      notes: "W-2, 401k+match+HSA+IRA",
    },
    B: {
      active: false,
      name: "WB Korea (4yr)",
      color: "#7C3AED",
      retireAge: 50,
      annualFinancialSavings: 45000,
      wbPensionEligible: false,
      wbPensionMonthly: 0,
      ssClaimAge: 67,
      notes: "WB Seoul 4yr then US return. Rule of 60 not met.",
    },
    C: {
      active: false,
      name: "WB DC (9yr)",
      color: "#059669",
      retireAge: 50,
      annualFinancialSavings: 50800,
      wbPensionEligible: false,
      wbPensionMonthly: 0,
      ssClaimAge: 67,
      notes: "WB DC until 50. Rule of 60 = 59, one point short.",
    },
    D: {
      active: true,
      name: "WB DC+Korea (14yr)",
      color: "#D97706",
      retireAge: 55,
      annualFinancialSavings: 74800,
      wbPensionEligible: true,
      wbPensionMonthly: 2000,
      ssClaimAge: 67,
      notes: "WB DC 9yr + Korea 5yr. Rule of 60 met. Pension + RMIP.",
    },
  },
};

const EXAMPLE_DATA = {
  ...INITIAL_STATE,
  profile: { name: "Alex", currentAge: 41, spouseAge: 41, targetRetireAge: 55, planToAge: 90, familyJoinAge: 65 },
  assets: {
    cash: 6500,
    taxable: 36000,
    rothSelf: 103000,
    rothBasis: 0,
    rothSpouse: 40000,
    rothSpouseBasis: 0,
    k401: 29000,
    rolloverIRA: 3600,
    hsa: 4000,
    homeValue: 730000,
    mortgage: 315000,
  },
  income: {
    ...INITIAL_STATE.income,
    employmentType: "W2",
    annualGross: 132600,
    salaryGrowthPct: 2.5,
    k401Annual: 25000,
    employerMatchPct: 3,
    hsaAnnual: 4300,
    healthPremium: 3600,
    estimatedTax: 15000,
    spouseAnnual: 87500,
    airbnb: 18000,
    otherAnnual: 15000,
    ssEstimatedAt62: 1737,
    ssClaimAge: 67,
  },
};

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value, compact = false) {
  const amount = n(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(amount);
}

function calcSSAnnual(estimatedAt62, claimAge) {
  if (!estimatedAt62 || estimatedAt62 === 0) return 0;
  const fraMonthly = estimatedAt62 / 0.7;
  if (claimAge <= 62) return estimatedAt62 * 12;
  if (claimAge >= 70) return fraMonthly * 1.24 * 12;
  return fraMonthly * 12;
}

function calcHomeProceeds(homeValue, mortgage, yearsToSale, homeAppPct) {
  const futureValue = n(homeValue) * Math.pow(1 + n(homeAppPct) / 100, Math.max(0, yearsToSale));
  const grossProceeds = futureValue * 0.94;
  return Math.max(0, grossProceeds - n(mortgage));
}

function applySpendingCurve(baseAnnualSpend, age) {
  if (age < 75) return baseAnnualSpend;
  if (age < 85) return baseAnnualSpend * 0.75;
  return baseAnnualSpend * 0.55;
}

function totalFinancialAssets(assets) {
  return n(assets.cash) + n(assets.taxable) + n(assets.rothSelf) + n(assets.rothSpouse) + n(assets.k401) + n(assets.rolloverIRA) + n(assets.hsa);
}

function bucketTotals(assets) {
  return {
    a: n(assets.cash) + n(assets.taxable),
    b: n(assets.rothSelf) + n(assets.rothSpouse),
    c: n(assets.k401) + n(assets.rolloverIRA) + n(assets.hsa),
  };
}

function runProjection(profile, assets, income, scenario, assumptions) {
  const r = n(assumptions.returnRatePct) / 100;
  let balance = totalFinancialAssets(assets);
  const dataPoints = [];
  const currentAge = Math.floor(n(profile.currentAge));
  const retireAge = Math.max(currentAge, Math.floor(n(scenario.retireAge)));
  const planToAge = Math.max(retireAge, Math.floor(n(profile.planToAge)));

  for (let age = currentAge; age < retireAge; age += 1) {
    balance = balance * (1 + r) + n(scenario.annualFinancialSavings);
    dataPoints.push({ age, balance: Math.round(balance), phase: "work" });
  }

  for (let age = retireAge; age <= planToAge; age += 1) {
    if (age === Math.floor(n(income.homeSaleAge))) {
      const yearsToSale = n(income.homeSaleAge) - currentAge;
      const proceeds = calcHomeProceeds(assets.homeValue, assets.mortgage, yearsToSale, assumptions.homeAppreciationPct);
      const koreaHomeCost = 350000 * Math.pow(1 + n(assumptions.inflationPct) / 100, Math.max(0, yearsToSale) / 2);
      balance += Math.max(0, proceeds - koreaHomeCost);
    }

    const wbPensionAnnual = scenario.wbPensionEligible ? n(scenario.wbPensionMonthly) * 12 : 0;
    const ssAnnual = age >= n(scenario.ssClaimAge || 67) ? calcSSAnnual(n(income.ssEstimatedAt62), n(scenario.ssClaimAge || 67)) : 0;
    const totalPassiveIncome = wbPensionAnnual + ssAnnual;
    const isFamily = age >= n(profile.familyJoinAge);
    const baseMonthly = isFamily ? n(income.koreaFamilyMonthly) : n(income.koreaSoloMonthly);
    const spending = applySpendingCurve(baseMonthly * 12, age);
    const netDraw = Math.max(0, spending - totalPassiveIncome);
    balance = Math.max(0, balance * (1 + r) - netDraw);

    dataPoints.push({
      age,
      balance: Math.round(balance),
      spending: Math.round(spending),
      passiveIncome: Math.round(totalPassiveIncome),
      netDraw: Math.round(netDraw),
      phase: "retire",
    });
  }

  return dataPoints;
}

function buildChartData(profile, assets, income, scenarios, assumptions) {
  const activeScenarios = Object.entries(scenarios).filter(([, s]) => s.active);
  if (!activeScenarios.length) return [];
  const byAge = {};
  activeScenarios.forEach(([, scenario]) => {
    runProjection(profile, assets, income, scenario, assumptions).forEach((pt) => {
      if (!byAge[pt.age]) byAge[pt.age] = { age: pt.age };
      byAge[pt.age][scenario.name] = Math.round(pt.balance / 1000);
    });
  });
  return Object.values(byAge).sort((a, b) => a.age - b.age);
}

function calcDieWithZero(profile, assets, income, scenario, assumptions) {
  const points = runProjection(profile, assets, income, scenario, assumptions);
  const retirePoints = points.filter((p) => p.phase === "retire");
  const atRetirement = retirePoints[0]?.balance || 0;
  const minBuffer = n(income.koreaSoloMonthly) * 12 * 2;
  const spendableExtra = Math.max(0, atRetirement - minBuffer);
  const goGoYears = Math.max(0, 75 - n(scenario.retireAge));
  const extraAnnual = goGoYears > 0 ? Math.round(spendableExtra / goGoYears) : 0;
  const baseSolo = n(income.koreaSoloMonthly) * 12;
  const baseFamily = n(income.koreaFamilyMonthly) * 12;
  return {
    atRetirement,
    spendableExtra,
    extraAnnual,
    optimalSoloMonthly: Math.round((baseSolo + extraAnnual) / 12),
    optimalFamilyMonthly: Math.round((baseFamily + extraAnnual) / 12),
    assetAt90: points[points.length - 1]?.balance || 0,
  };
}

function checkRuleOf60(retireAge, yearsOfService) {
  return n(retireAge) + n(yearsOfService) >= 60;
}

function calcNetCompensation(income) {
  if (income.employmentType === "W2") {
    const ficaBurden = n(income.annualGross) * 0.0765;
    const cash = n(income.annualGross) - ficaBurden - n(income.k401Annual) - n(income.hsaAnnual) * 0.75 - n(income.healthPremium) - n(income.estimatedTax);
    const retirementSavings = n(income.k401Annual) + n(income.annualGross) * (n(income.employerMatchPct) / 100) + n(income.hsaAnnual);
    return { cash: Math.round(cash), retirement: Math.round(retirementSavings), total: Math.round(cash + retirementSavings) };
  }
  if (income.employmentType === "WB_US") {
    const seBurden = n(income.annualGross) * (n(income.wbSEtaxBurdenPct) / 100);
    const wbPensionSol = n(income.annualGross) * (n(income.wbPensionEmpPct) / 100);
    const wbPensionWB = n(income.annualGross) * (n(income.wbPensionWBPct) / 100);
    const incomeTax = income.wbTaxAllowance ? 0 : n(income.estimatedTax);
    const cash = n(income.annualGross) - seBurden - wbPensionSol - n(income.healthPremium) - incomeTax;
    const retirement = wbPensionSol + wbPensionWB;
    return { cash: Math.round(cash), retirement: Math.round(retirement), total: Math.round(cash + retirement) };
  }
  if (income.employmentType === "WB_INTL") {
    const wbPensionSol = n(income.annualGross) * (n(income.wbPensionEmpPct) / 100);
    const wbPensionWB = n(income.annualGross) * (n(income.wbPensionWBPct) / 100);
    const cash = n(income.annualGross) - wbPensionSol;
    const retirement = wbPensionSol + wbPensionWB;
    return { cash: Math.round(cash), retirement: Math.round(retirement), total: Math.round(cash + retirement) };
  }
  if (income.employmentType === "SE") {
    const seTax = n(income.annualGross) * (n(income.seSelfTaxPct) / 100);
    return { cash: Math.round(n(income.annualGross) - seTax - n(income.estimatedTax)), retirement: 0, total: Math.round(n(income.annualGross) - seTax - n(income.estimatedTax)) };
  }
  return { cash: 0, retirement: 0, total: 0 };
}

function calcCompForType(income, employmentType, annualGross = income.annualGross) {
  return calcNetCompensation({ ...income, employmentType, annualGross });
}

function findEquivalentSalary(income, targetTotal, employmentType) {
  for (let salary = 30000; salary <= 600000; salary += 1000) {
    if (calcCompForType(income, employmentType, salary).total >= targetTotal) return salary;
  }
  return null;
}

function estimateAssetsAtRetire(profile, assets, scenario, assumptions) {
  const years = Math.max(0, n(scenario.retireAge) - n(profile.currentAge));
  const r = n(assumptions.returnRatePct) / 100;
  let balance = totalFinancialAssets(assets);
  for (let i = 0; i < years; i += 1) balance = balance * (1 + r) + n(scenario.annualFinancialSavings);
  return Math.round(balance);
}

async function loadStoredState() {
  try {
    if (window.storage?.get) {
      const result = await window.storage.get(STORAGE_KEY);
      return result ? JSON.parse(result.value) : null;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveStoredState(data) {
  try {
    if (window.storage?.set) {
      await window.storage.set(STORAGE_KEY, JSON.stringify(data));
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage can fail in private browser modes.
  }
}

function buildSystemPrompt(state) {
  const { profile, assets, income, scenarios, assumptions } = state;
  const activeScenarios = Object.entries(scenarios)
    .filter(([, s]) => s.active)
    .map(([id, s]) => `${id}:${s.name}(retire@${s.retireAge}, save$${s.annualFinancialSavings}/yr${s.wbPensionEligible ? `, WBpension$${s.wbPensionMonthly}/mo` : ""})`)
    .join(" | ");

  return `You are an expert retirement planning advisor. Be direct, analytical, and quantify when possible. This is educational planning, not personalized legal, tax, or investment advice.

USER PROFILE:
Name: ${profile.name || "User"} | Age: ${profile.currentAge} | Spouse age: ${profile.spouseAge}
Retire target: ${profile.targetRetireAge} | Lifespan target: ${profile.planToAge}
Family joins Korea at: ${profile.familyJoinAge}

CURRENT ASSETS:
Bucket A: Cash $${assets.cash || 0}, Taxable $${assets.taxable || 0}
Bucket B: Self Roth $${assets.rothSelf || 0} [basis $${assets.rothBasis || 0}], Spouse Roth $${assets.rothSpouse || 0} [basis $${assets.rothSpouseBasis || 0}]
Bucket C: 401k $${assets.k401 || 0}, IRA $${assets.rolloverIRA || 0}, HSA $${assets.hsa || 0}
Real Estate: Home $${assets.homeValue || 0}, Mortgage $${assets.mortgage || 0}
Total financial assets: $${totalFinancialAssets(assets).toLocaleString()}

INCOME:
Employment type: ${income.employmentType}
Annual gross: $${income.annualGross || 0} (${income.salaryGrowthPct}%/yr growth)
Spouse: $${income.spouseAnnual || 0}/yr
Other: $${(income.airbnb || 0) + (income.otherAnnual || 0)}/yr
SS estimated at 62: $${income.ssEstimatedAt62 || 0}/month | Plan to claim at ${income.ssClaimAge}
Korea solo budget: $${income.koreaSoloMonthly || 0}/month | Family budget: $${income.koreaFamilyMonthly || 0}/month
Home sale planned at age: ${income.homeSaleAge || 65}

ASSUMPTIONS: Return ${assumptions.returnRatePct}% | Inflation ${assumptions.inflationPct}% | Home appreciation ${assumptions.homeAppreciationPct}%
ACTIVE SCENARIOS: ${activeScenarios || "None active"}

CRITICAL KNOWLEDGE:
1. Roth bridge: only contribution basis, not earnings, can be withdrawn before 59.5 without penalty.
2. World Bank Rule of 60: age at retirement + years of service >= 60 for lifetime annuity. Below 60 generally means cash balance lump sum.
3. WB US-based staff: net SE tax burden roughly 7.25% after WB coverage/deduction effect. WB overseas: no SE tax.
4. WB RMIP may materially reduce the pre-Medicare health gap when Rule of 60 and service rules are met.
5. Social Security foreign work test can matter if claiming early while working abroad without US SS taxes.
6. User embraces Die with Zero: optimize lifetime experiences, avoid unnecessarily large age-90 balance.
7. Withdrawal order: Bucket A, then Roth basis bridge, then Bucket C plus SS/WB pension. User rejects 72(t).
8. Spending curve: under 75 = 100%, 75-84 = 75%, 85+ = 55%.
9. Korea dual residency and health insurance eligibility are important planning risks.
10. USD assets funding KRW spending creates FX upside and risk.`;
}

const page = { minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: BODY_FONT };
const wrap = { maxWidth: 1080, margin: "0 auto", padding: "22px 16px 44px" };
const card = { background: COLORS.card, borderRadius: 12, border: `1px solid ${COLORS.border}`, boxShadow: "0 8px 20px rgba(26,35,50,0.06)", padding: 20 };
const inputBase = { width: "100%", boxSizing: "border-box", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 11px", font: `500 14px ${BODY_FONT}`, color: COLORS.text, background: "#fff" };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: COLORS.muted, marginBottom: 6 };
const small = { fontSize: 12, color: COLORS.muted, lineHeight: 1.4 };

function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return narrow;
}

function Grid({ children, columns = 2, narrow }) {
  return <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : `repeat(${columns}, minmax(0, 1fr))`, gap: 14 }}>{children}</div>;
}

function Field({ label, value, onChange, type = "number", options, multiline = false }) {
  const handle = (event) => {
    if (type === "checkbox") onChange(event.target.checked);
    else if (type === "number") onChange(event.target.value === "" ? 0 : Number(event.target.value));
    else onChange(event.target.value);
  };
  return (
    <label>
      <span style={labelStyle}>{label}</span>
      {options ? (
        <select value={value} onChange={handle} style={inputBase}>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : multiline ? (
        <textarea value={value || ""} onChange={handle} rows={3} style={{ ...inputBase, resize: "vertical" }} />
      ) : type === "checkbox" ? (
        <input type="checkbox" checked={Boolean(value)} onChange={handle} style={{ width: 18, height: 18 }} />
      ) : (
        <input type={type} value={value ?? ""} onChange={handle} style={{ ...inputBase, fontFamily: type === "number" ? MONEY_FONT : BODY_FONT }} />
      )}
    </label>
  );
}

function Section({ title, children, right }) {
  return (
    <section style={{ ...card, marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, color = COLORS.header }) {
  return (
    <div style={card}>
      <div style={{ ...small, fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: 8, color, fontFamily: MONEY_FONT, fontSize: 24, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function Button({ children, onClick, tone = "primary", type = "button", disabled = false }) {
  const bg = tone === "primary" ? COLORS.header : tone === "danger" ? COLORS.warn : "#E7EEF6";
  const color = tone === "primary" || tone === "danger" ? "#fff" : COLORS.text;
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{ border: 0, borderRadius: 8, background: disabled ? "#CBD5E1" : bg, color, padding: "10px 13px", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer" }}>
      {children}
    </button>
  );
}

function MiniChart({ state, height = 240 }) {
  const chartData = useMemo(() => buildChartData(state.profile, state.assets, state.income, state.scenarios, state.assumptions), [state]);
  const active = Object.values(state.scenarios).filter((s) => s.active);
  if (!active.length) {
    return (
      <div style={{ minHeight: height, display: "grid", placeItems: "center", color: COLORS.muted, textAlign: "center" }}>
        Turn on at least one scenario in Edit Scenarios to show a projection.
      </div>
    );
  }
  if (!chartData.length) {
    return (
      <div style={{ minHeight: height, display: "grid", placeItems: "center", color: COLORS.muted, textAlign: "center" }}>
        Projection data is not available yet. Check ages, assumptions, and active scenarios.
      </div>
    );
  }
  return (
    <div style={{ width: "100%", height, minHeight: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 12, right: 14, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="age" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => `$${v}K`} tick={{ fontSize: 12 }} width={64} />
          <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}K`, "Assets"]} labelFormatter={(age) => `Age ${age}`} />
          {active.map((s) => <Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2.5} dot={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Dashboard({ state, setState, setTab, narrow }) {
  const totals = bucketTotals(state.assets);
  const isExample = JSON.stringify(state.profile) === JSON.stringify(EXAMPLE_DATA.profile) && n(state.assets.cash) === n(EXAMPLE_DATA.assets.cash);
  const alerts = [];
  if (n(state.assets.rothBasis) === 0 && n(state.assets.rothSelf) > 0) alerts.push({ text: "Roth IRA basis not tracked. Only contribution basis can be withdrawn penalty-free before 59.5.", action: "Enter Roth basis", tab: "Setup" });
  if (!n(state.income.ssEstimatedAt62)) alerts.push("Social Security estimate is not set.");
  if (!Object.values(state.scenarios).some((s) => s.active)) alerts.push("No scenarios are active.");

  return (
    <>
      {isExample && (
        <section style={{ ...card, marginBottom: 16, borderColor: "#BFDBFE", background: "#EFF6FF" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 800 }}>Using example data</div>
              <div style={small}>Replace it with your own profile, assets, and income assumptions to make the projections meaningful.</div>
            </div>
            <Button onClick={() => setTab("Setup")}>Enter My Data</Button>
          </div>
        </section>
      )}
      <Grid columns={4} narrow={narrow}>
        <StatCard label="Years to Retire" value={Math.max(0, n(state.profile.targetRetireAge) - n(state.profile.currentAge))} />
        <StatCard label="Total Financial Assets" value={money(totalFinancialAssets(state.assets), true)} color={COLORS.bucketA} />
        <StatCard label="SS at 62 Monthly" value={money(state.income.ssEstimatedAt62)} color={COLORS.bucketC} />
        <StatCard label="Target Retire Age" value={state.profile.targetRetireAge} color={COLORS.amber} />
      </Grid>
      <Section title="Projection Snapshot" right={<Button tone="secondary" onClick={() => setTab("Projection")}>Open Full Projection</Button>}>
        <MiniChart state={state} />
      </Section>
      <Grid columns={3} narrow={narrow}>
        <StatCard label="Bucket A Accessible" value={money(totals.a)} color={COLORS.bucketA} />
        <StatCard label="Bucket B Roth Bridge" value={money(totals.b)} color={COLORS.bucketB} />
        <StatCard label="Bucket C Locked Later" value={money(totals.c)} color={COLORS.bucketC} />
      </Grid>
      <Section title="Alerts" right={!isExample ? <Button tone="secondary" onClick={() => setState(EXAMPLE_DATA)}>Load Example</Button> : null}>
        {alerts.length ? alerts.map((a) => {
          const alert = typeof a === "string" ? { text: a } : a;
          return (
            <div key={alert.text} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <div style={{ color: COLORS.warn, fontWeight: 700 }}>{alert.text}</div>
              {alert.action && <Button tone="secondary" onClick={() => setTab(alert.tab)}>{alert.action}</Button>}
            </div>
          );
        }) : <div style={small}>No active warnings.</div>}
      </Section>
    </>
  );
}

function Setup({ state, update, narrow }) {
  const { profile, assets, income, assumptions } = state;
  const setProfile = (key, value) => update("profile", key, value);
  const setAssets = (key, value) => update("assets", key, value);
  const setIncome = (key, value) => update("income", key, value);
  const setAssumptions = (key, value) => update("assumptions", key, value);
  const totals = bucketTotals(assets);
  const ssFra = n(income.ssEstimatedAt62) / 0.7;
  const ss70 = ssFra * 1.24;

  return (
    <>
      <Section title="Profile">
        <Grid columns={2} narrow={narrow}>
          <Field label="Name" value={profile.name} type="text" onChange={(v) => setProfile("name", v)} />
          <Field label="Current Age" value={profile.currentAge} onChange={(v) => setProfile("currentAge", v)} />
          <Field label="Spouse Age" value={profile.spouseAge} onChange={(v) => setProfile("spouseAge", v)} />
          <Field label="Target Retirement Age" value={profile.targetRetireAge} onChange={(v) => setProfile("targetRetireAge", v)} />
          <Field label="Plan to Age" value={profile.planToAge} onChange={(v) => setProfile("planToAge", v)} />
          <Field label="Family Joins Korea at Age" value={profile.familyJoinAge} onChange={(v) => setProfile("familyJoinAge", v)} />
        </Grid>
      </Section>
      <Section title="Assets" right={<span style={small}>Financial total: {money(totalFinancialAssets(assets))}</span>}>
        <Grid columns={3} narrow={narrow}>
          <div>
            <h3 style={{ color: COLORS.bucketA }}>Bucket A {money(totals.a)}</h3>
            <Field label="Cash" value={assets.cash} onChange={(v) => setAssets("cash", v)} />
            <Field label="Taxable Brokerage" value={assets.taxable} onChange={(v) => setAssets("taxable", v)} />
          </div>
          <div>
            <h3 style={{ color: COLORS.bucketB }}>Bucket B {money(totals.b)}</h3>
            <Field label="Roth IRA Self" value={assets.rothSelf} onChange={(v) => setAssets("rothSelf", v)} />
            <Field label="Roth Contribution Basis" value={assets.rothBasis} onChange={(v) => setAssets("rothBasis", v)} />
            <Field label="Roth IRA Spouse" value={assets.rothSpouse} onChange={(v) => setAssets("rothSpouse", v)} />
            <Field label="Spouse Roth Basis" value={assets.rothSpouseBasis} onChange={(v) => setAssets("rothSpouseBasis", v)} />
          </div>
          <div>
            <h3 style={{ color: COLORS.bucketC }}>Bucket C {money(totals.c)}</h3>
            <Field label="401k" value={assets.k401} onChange={(v) => setAssets("k401", v)} />
            <Field label="Rollover/Traditional IRA" value={assets.rolloverIRA} onChange={(v) => setAssets("rolloverIRA", v)} />
            <Field label="HSA" value={assets.hsa} onChange={(v) => setAssets("hsa", v)} />
          </div>
        </Grid>
        <div style={{ marginTop: 14 }}>
          <Grid columns={2} narrow={narrow}>
            <Field label="Home Value" value={assets.homeValue} onChange={(v) => setAssets("homeValue", v)} />
            <Field label="Mortgage Balance" value={assets.mortgage} onChange={(v) => setAssets("mortgage", v)} />
          </Grid>
          <div style={{ ...small, marginTop: 8 }}>Home equity: {money(Math.max(0, n(assets.homeValue) - n(assets.mortgage)))}. Real estate is shown separately from financial assets.</div>
        </div>
      </Section>
      <Section title="Income & Assumptions">
        <Grid columns={2} narrow={narrow}>
          <Field label="Employment Type" value={income.employmentType} onChange={(v) => setIncome("employmentType", v)} options={[
            { value: "W2", label: "W-2 Employee" },
            { value: "WB_US", label: "International Org US-based" },
            { value: "WB_INTL", label: "International Org Abroad" },
            { value: "SE", label: "Self-Employed" },
            { value: "NONE", label: "Retired / None" },
          ]} />
          <Field label="Annual Gross Salary" value={income.annualGross} onChange={(v) => setIncome("annualGross", v)} />
          <Field label="Salary Growth %" value={income.salaryGrowthPct} onChange={(v) => setIncome("salaryGrowthPct", v)} />
          {income.employmentType === "W2" && (
            <>
              <Field label="401k Contribution" value={income.k401Annual} onChange={(v) => setIncome("k401Annual", v)} />
              <Field label="Employer Match %" value={income.employerMatchPct} onChange={(v) => setIncome("employerMatchPct", v)} />
              <Field label="HSA Total" value={income.hsaAnnual} onChange={(v) => setIncome("hsaAnnual", v)} />
              <Field label="Health Premium" value={income.healthPremium} onChange={(v) => setIncome("healthPremium", v)} />
              <Field label="Estimated Tax" value={income.estimatedTax} onChange={(v) => setIncome("estimatedTax", v)} />
            </>
          )}
          {(income.employmentType === "WB_US" || income.employmentType === "WB_INTL") && (
            <>
              <Field label="WB Years of Service" value={income.wbYearsService} onChange={(v) => setIncome("wbYearsService", v)} />
              {income.employmentType === "WB_US" && <Field label="SE Tax Burden %" value={income.wbSEtaxBurdenPct} onChange={(v) => setIncome("wbSEtaxBurdenPct", v)} />}
              <Field label="Employee Pension %" value={income.wbPensionEmpPct} onChange={(v) => setIncome("wbPensionEmpPct", v)} />
              <Field label="Employer Pension %" value={income.wbPensionWBPct} onChange={(v) => setIncome("wbPensionWBPct", v)} />
              {income.employmentType === "WB_US" && <Field label="Tax Allowance" value={income.wbTaxAllowance} type="checkbox" onChange={(v) => setIncome("wbTaxAllowance", v)} />}
            </>
          )}
          {income.employmentType === "SE" && <Field label="SE Tax Rate %" value={income.seSelfTaxPct} onChange={(v) => setIncome("seSelfTaxPct", v)} />}
          <Field label="Spouse Annual Income" value={income.spouseAnnual} onChange={(v) => setIncome("spouseAnnual", v)} />
          <Field label="Airbnb/Rental Income" value={income.airbnb} onChange={(v) => setIncome("airbnb", v)} />
          <Field label="Other Income" value={income.otherAnnual} onChange={(v) => setIncome("otherAnnual", v)} />
          <Field label="SS Estimated at 62 ($/month)" value={income.ssEstimatedAt62} onChange={(v) => setIncome("ssEstimatedAt62", v)} />
          <Field label="Plan to Claim SS" value={income.ssClaimAge} onChange={(v) => setIncome("ssClaimAge", v)} options={[{ value: 62, label: "62" }, { value: 67, label: "67" }, { value: 70, label: "70" }]} />
          <Field label="Home Sale Age" value={income.homeSaleAge} onChange={(v) => setIncome("homeSaleAge", v)} />
          <Field label="Korea Solo Monthly Budget" value={income.koreaSoloMonthly} onChange={(v) => setIncome("koreaSoloMonthly", v)} />
          <Field label="Korea Family Monthly Budget" value={income.koreaFamilyMonthly} onChange={(v) => setIncome("koreaFamilyMonthly", v)} />
          <Field label="Return Rate %" value={assumptions.returnRatePct} onChange={(v) => setAssumptions("returnRatePct", v)} />
          <Field label="Inflation %" value={assumptions.inflationPct} onChange={(v) => setAssumptions("inflationPct", v)} />
          <Field label="Home Appreciation %" value={assumptions.homeAppreciationPct} onChange={(v) => setAssumptions("homeAppreciationPct", v)} />
        </Grid>
        <div style={{ ...small, marginTop: 12 }}>SS auto-calculation: FRA 67 approx. {money(ssFra)}/month, age 70 approx. {money(ss70)}/month.</div>
        {(income.employmentType === "WB_US" || income.employmentType === "WB_INTL") && <NetComp income={income} />}
      </Section>
    </>
  );
}

function NetComp({ income }) {
  const currentW2 = calcNetCompensation({ ...income, employmentType: "W2" });
  const wb = calcNetCompensation(income);
  let equivalent = 0;
  for (let salary = 50000; salary <= 500000; salary += 1000) {
    const total = calcNetCompensation({ ...income, annualGross: salary }).total;
    if (total >= currentW2.total) {
      equivalent = salary;
      break;
    }
  }
  return (
    <div style={{ ...card, background: "#F8FAFC", boxShadow: "none", marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Net Compensation Comparison</h3>
      <Grid columns={3} narrow={false}>
        <StatCard label="Current W2 Total" value={money(currentW2.total)} />
        <StatCard label="Selected Role Total" value={money(wb.total)} color={COLORS.bucketB} />
        <StatCard label="WB Equivalent Salary" value={equivalent ? money(equivalent) : "Above $500K"} color={COLORS.bucketC} />
      </Grid>
    </div>
  );
}

function Scenarios({ state, setState, narrow }) {
  const updateScenario = (id, key, value) => {
    setState((prev) => ({ ...prev, scenarios: { ...prev.scenarios, [id]: { ...prev.scenarios[id], [key]: value } } }));
  };
  const resetScenario = (id) => {
    setState((prev) => ({ ...prev, scenarios: { ...prev.scenarios, [id]: INITIAL_STATE.scenarios[id] } }));
  };
  const duplicateScenario = (id) => {
    const ids = Object.keys(state.scenarios);
    const start = ids.indexOf(id);
    const target = ids
      .slice(start + 1)
      .concat(ids.slice(0, start))
      .find((candidate) => candidate !== id);
    if (!target) return;
    setState((prev) => ({
      ...prev,
      scenarios: {
        ...prev.scenarios,
        [target]: {
          ...prev.scenarios[id],
          name: `${prev.scenarios[id].name || `Scenario ${id}`} copy`,
          active: true,
        },
      },
    }));
  };
  return (
    <>
      <Section title="Edit Scenario Slots" right={<span style={small}>Four editable slots: A, B, C, D</span>}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Use this page to tailor the scenarios that appear in Dashboard and Projection.</div>
          <div style={small}>Edit any slot directly. Turn the header checkbox on to include it in charts. Use Duplicate to copy a useful scenario into another slot, then change the salary, retire age, pension, or notes.</div>
        </div>
      </Section>
      <Grid columns={2} narrow={narrow}>
        {Object.entries(state.scenarios).map(([id, s]) => {
          const score = n(s.retireAge) + n(state.income.wbYearsService);
          const warning = s.wbPensionEligible && !checkRuleOf60(s.retireAge, state.income.wbYearsService);
          return (
            <section key={id} style={card}>
              <div style={{ background: s.color, color: "#fff", borderRadius: 8, padding: 12, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{id}. {s.name || "Scenario"}</strong>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800 }}>
                  Show in charts
                  <input type="checkbox" checked={s.active} onChange={(e) => updateScenario(id, "active", e.target.checked)} style={{ width: 18, height: 18 }} />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                <Button tone="secondary" onClick={() => duplicateScenario(id)}>Duplicate to Next Slot</Button>
                <Button tone="secondary" onClick={() => resetScenario(id)}>Reset Slot</Button>
              </div>
              <Grid columns={2} narrow={narrow}>
                <Field label="Name" type="text" value={s.name} onChange={(v) => updateScenario(id, "name", v)} />
                <Field label="Color" type="color" value={s.color} onChange={(v) => updateScenario(id, "color", v)} />
                <Field label="Retire Age" value={s.retireAge} onChange={(v) => updateScenario(id, "retireAge", v)} />
                <Field label="Annual Financial Savings" value={s.annualFinancialSavings} onChange={(v) => updateScenario(id, "annualFinancialSavings", v)} />
                <Field label="WB Pension Eligible" type="checkbox" value={s.wbPensionEligible} onChange={(v) => updateScenario(id, "wbPensionEligible", v)} />
                <Field label="WB Pension Monthly" value={s.wbPensionMonthly} onChange={(v) => updateScenario(id, "wbPensionMonthly", v)} />
                <Field label="SS Claim Age" value={s.ssClaimAge} onChange={(v) => updateScenario(id, "ssClaimAge", v)} options={[{ value: 62, label: "62" }, { value: 67, label: "67" }, { value: 70, label: "70" }]} />
              </Grid>
              <div style={{ marginTop: 12 }}><Field label="Notes" type="text" multiline value={s.notes} onChange={(v) => updateScenario(id, "notes", v)} /></div>
              {warning && <div style={{ color: COLORS.warn, fontWeight: 700, marginTop: 10 }}>Rule of 60 not met ({score}/60). Pension likely cash balance, not lifetime annuity.</div>}
            </section>
          );
        })}
      </Grid>
      <Section title="Comparison Table" right={<span style={small}>Scenario savings exclude mortgage principal paydown.</span>}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead><tr>{["Scenario", "Retire Age", "Annual Savings", "WB Pension", "SS Age", "Est. Assets at Retirement"].map((h) => <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted }}>{h}</th>)}</tr></thead>
            <tbody>
              {Object.entries(state.scenarios).map(([id, s]) => (
                <tr key={id}>
                  <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, color: s.color, fontWeight: 800 }}>{id}. {s.name}</td>
                  <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}` }}>{s.retireAge}</td>
                  <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, fontFamily: MONEY_FONT }}>{money(s.annualFinancialSavings)}</td>
                  <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}` }}>{s.wbPensionEligible ? money(s.wbPensionMonthly) + "/mo" : "-"}</td>
                  <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}` }}>{s.ssClaimAge}</td>
                  <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, fontFamily: MONEY_FONT }}>{money(estimateAssetsAtRetire(state.profile, state.assets, s, state.assumptions))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

function Projection({ state, narrow }) {
  const active = Object.values(state.scenarios).filter((s) => s.active);
  const [selected, setSelected] = useState(active[0]?.name || "");
  useEffect(() => {
    if (!active.find((s) => s.name === selected)) setSelected(active[0]?.name || "");
  }, [active, selected]);
  const chartData = useMemo(() => buildChartData(state.profile, state.assets, state.income, state.scenarios, state.assumptions), [state]);
  const scenario = active.find((s) => s.name === selected) || active[0];
  const dwz = scenario ? calcDieWithZero(state.profile, state.assets, state.income, scenario, state.assumptions) : null;
  const earliestRetire = active.length ? Math.min(...active.map((s) => n(s.retireAge))) : null;
  const ssStart = active.length ? Math.min(...active.map((s) => n(s.ssClaimAge))) : n(state.income.ssClaimAge);

  return (
    <>
      <Section title="Projection">
        <div style={{ height: narrow ? 300 : 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 12, right: 20, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="age" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `$${v}K`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}K`, "Assets"]} labelFormatter={(age) => `Age ${age}`} />
              <Legend />
              {earliestRetire && <ReferenceLine x={earliestRetire} stroke={COLORS.warn} label="Retire" />}
              <ReferenceLine x={n(state.profile.familyJoinAge)} stroke={COLORS.bucketB} label="Family Korea" />
              <ReferenceLine x={ssStart} stroke={COLORS.bucketC} label="SS Start" />
              <ReferenceLine x={n(state.income.homeSaleAge)} stroke={COLORS.amber} label="Home Sale" />
              {active.map((s) => <Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={3} dot={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>
      <Grid columns={active.length || 1} narrow={narrow}>
        {active.map((s) => {
          const ssMonthly = calcSSAnnual(n(state.income.ssEstimatedAt62), n(s.ssClaimAge)) / 12;
          const wb = s.wbPensionEligible ? n(s.wbPensionMonthly) : 0;
          return <StatCard key={s.name} label={`${s.name} Passive Income/mo`} value={money(wb + ssMonthly)} color={s.color} />;
        })}
      </Grid>
      <Section title="Die with Zero">
        {scenario && dwz ? (
          <>
            <Field label="Scenario" value={selected} type="text" onChange={setSelected} options={active.map((s) => ({ value: s.name, label: s.name }))} />
            <Grid columns={3} narrow={narrow}>
              <StatCard label="Assets at Retirement" value={money(dwz.atRetirement)} />
              <StatCard label="Extra Go-Go Available" value={money(dwz.spendableExtra)} color={COLORS.bucketB} />
              <StatCard label="Extra Per Year" value={money(dwz.extraAnnual)} color={COLORS.bucketC} />
              <StatCard label="Optimal Solo Monthly" value={money(dwz.optimalSoloMonthly)} />
              <StatCard label="Optimal Family Monthly" value={money(dwz.optimalFamilyMonthly)} />
              <StatCard label="Projected Age-90 Balance" value={money(dwz.assetAt90)} color={COLORS.amber} />
            </Grid>
            <div style={{ ...card, marginTop: 14, background: "#F8FAFC", boxShadow: "none" }}>
              Conservative plan leaves {money(dwz.assetAt90)} at 90. Die with Zero suggests roughly {money(Math.round(dwz.extraAnnual / 12))} more per month during go-go years for this scenario.
            </div>
          </>
        ) : <div style={small}>Activate a scenario to analyze.</div>}
      </Section>
    </>
  );
}

function JobCompare({ state, update, narrow }) {
  const { income, scenarios } = state;
  const setIncome = (key, value) => update("income", key, value);
  const types = [
    { id: "W2", label: "Current W-2", note: "FICA, estimated tax, 401k, match, HSA." },
    { id: "WB_US", label: "WB / Intl Org US", note: "Models WB tax allowance and reduced SE tax burden." },
    { id: "WB_INTL", label: "WB / Intl Org Abroad", note: "No US SE tax in this simplified model." },
    { id: "SE", label: "Self-Employed", note: "Uses SE tax rate and estimated tax." },
  ];
  const baseline = calcCompForType(income, "W2", income.annualGross);
  const wbUsEquivalent = findEquivalentSalary(income, baseline.total, "WB_US");
  const wbIntlEquivalent = findEquivalentSalary(income, baseline.total, "WB_INTL");

  return (
    <>
      <Section title="Job Comparison Setup">
        <Grid columns={3} narrow={narrow}>
          <Field label="Current / Offer Salary" value={income.annualGross} onChange={(v) => setIncome("annualGross", v)} />
          <Field label="Estimated Tax" value={income.estimatedTax} onChange={(v) => setIncome("estimatedTax", v)} />
          <Field label="Health Premium" value={income.healthPremium} onChange={(v) => setIncome("healthPremium", v)} />
          <Field label="401k Contribution" value={income.k401Annual} onChange={(v) => setIncome("k401Annual", v)} />
          <Field label="Employer Match %" value={income.employerMatchPct} onChange={(v) => setIncome("employerMatchPct", v)} />
          <Field label="HSA Total" value={income.hsaAnnual} onChange={(v) => setIncome("hsaAnnual", v)} />
          <Field label="WB Years of Service" value={income.wbYearsService} onChange={(v) => setIncome("wbYearsService", v)} />
          <Field label="WB US SE Burden %" value={income.wbSEtaxBurdenPct} onChange={(v) => setIncome("wbSEtaxBurdenPct", v)} />
          <Field label="WB Employee Pension %" value={income.wbPensionEmpPct} onChange={(v) => setIncome("wbPensionEmpPct", v)} />
          <Field label="WB Employer Pension %" value={income.wbPensionWBPct} onChange={(v) => setIncome("wbPensionWBPct", v)} />
          <Field label="WB Tax Allowance" value={income.wbTaxAllowance} type="checkbox" onChange={(v) => setIncome("wbTaxAllowance", v)} />
          <Field label="Self-Employment Tax %" value={income.seSelfTaxPct} onChange={(v) => setIncome("seSelfTaxPct", v)} />
        </Grid>
      </Section>
      <Section title="Annual Compensation Comparison" right={<span style={small}>Same gross salary unless equivalent salary is shown.</span>}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr>{["Job Type", "Cash Take-Home", "Retirement Value", "Total Annual Value", "Gap vs W-2", "Planning Note"].map((h) => <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {types.map((type) => {
                const comp = calcCompForType(income, type.id);
                const gap = comp.total - baseline.total;
                return (
                  <tr key={type.id}>
                    <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, fontWeight: 800 }}>{type.label}</td>
                    <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, fontFamily: MONEY_FONT }}>{money(comp.cash)}</td>
                    <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, fontFamily: MONEY_FONT }}>{money(comp.retirement)}</td>
                    <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, fontFamily: MONEY_FONT }}>{money(comp.total)}</td>
                    <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, color: gap >= 0 ? COLORS.bucketC : COLORS.warn, fontWeight: 800 }}>{gap >= 0 ? "+" : ""}{money(gap)}</td>
                    <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted }}>{type.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
      <Grid columns={3} narrow={narrow}>
        <StatCard label="W-2 Total Value" value={money(baseline.total)} />
        <StatCard label="WB US Salary to Match" value={wbUsEquivalent ? money(wbUsEquivalent) : ">$600K"} color={COLORS.bucketB} />
        <StatCard label="WB Abroad Salary to Match" value={wbIntlEquivalent ? money(wbIntlEquivalent) : ">$600K"} color={COLORS.bucketC} />
      </Grid>
      <Section title="Rule of 60 by Scenario">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
            <thead>
              <tr>{["Scenario", "Retire Age", "WB Service Years", "Score", "Pension Result"].map((h) => <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {Object.entries(scenarios).map(([id, s]) => {
                const score = n(s.retireAge) + n(income.wbYearsService);
                const met = score >= 60;
                return (
                  <tr key={id}>
                    <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, color: s.color, fontWeight: 800 }}>{id}. {s.name}</td>
                    <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}` }}>{s.retireAge}</td>
                    <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}` }}>{income.wbYearsService}</td>
                    <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, fontWeight: 800 }}>{score}/60</td>
                    <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, color: met ? COLORS.bucketC : COLORS.warn, fontWeight: 800 }}>{met ? "Lifetime pension path" : "Cash balance risk"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

function AIAdvisor({ state }) {
  const [messages, setMessages] = useState([{ role: "assistant", content: "I can compare scenarios, stress-test the WB Rule of 60, explain SS timing, or translate the numbers into a Die with Zero spending plan." }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const quick = ["Which scenario is best for me?", "How should I think about SS timing?", "Am I on track for Die with Zero?", "What are my biggest retirement risks?", "How does WB Rule of 60 affect my plan?", "Compare my WB DC salary to my current W2"];

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text = input) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const nextMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const conversationHistory = nextMessages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
      const response = await fetch("/api/anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: buildSystemPrompt(state),
          messages: conversationHistory,
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message || data.error);
      const reply = data.content?.[0]?.text || "I could not read the model response.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't connect to the AI. Check your Vercel environment variable and try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section title="AI Advisor">
      <div ref={listRef} style={{ height: 390, overflowY: "auto", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14, background: "#F8FAFC" }}>
        {messages.map((m, idx) => (
          <div key={`${m.role}-${idx}`} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
            <div style={{ maxWidth: "82%", background: m.role === "user" ? COLORS.header : "#fff", color: m.role === "user" ? "#fff" : COLORS.text, borderRadius: 10, padding: 12, lineHeight: 1.45, whiteSpace: "pre-wrap", border: m.role === "user" ? 0 : `1px solid ${COLORS.border}` }}>{m.content}</div>
          </div>
        ))}
        {loading && <div style={small}>Thinking...</div>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {quick.map((q) => <Button key={q} tone="secondary" onClick={() => send(q)} disabled={loading}>{q}</Button>)}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="Ask about your retirement plan..." style={inputBase} />
        <Button onClick={() => send()} disabled={loading}>Send</Button>
      </div>
    </Section>
  );
}

export default function RetireMap() {
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("Dashboard");
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef(null);
  const didLoad = useRef(false);
  const narrow = useIsNarrow();
  const tabs = ["Dashboard", "Setup", "Job Compare", "Edit Scenarios", "Projection", "AI Advisor"];

  useEffect(() => {
    loadStoredState().then((data) => {
      setState(data || EXAMPLE_DATA);
      setLoaded(true);
      didLoad.current = true;
    });
  }, []);

  useEffect(() => {
    if (!state || !didLoad.current) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      await saveStoredState(state);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
    }, 300);
    return () => window.clearTimeout(saveTimer.current);
  }, [state]);

  const update = useCallback((section, key, value) => {
    setState((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  }, []);

  if (!loaded || !state) {
    return <main style={page}><div style={wrap}>Loading...</div></main>;
  }

  return (
    <main style={page}>
      <header style={{ background: COLORS.header, color: "#fff" }}>
        <div style={{ ...wrap, paddingTop: 22, paddingBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: narrow ? 28 : 34, letterSpacing: 0 }}>RetireMap</h1>
              <p style={{ margin: "6px 0 0", color: "#CBD5E1" }}>Scenario-based retirement planning through age {state.profile.planToAge}</p>
              <p style={{ margin: "4px 0 0", color: "#94A3B8", fontSize: 12 }}>Build: GitHub main / RetireMap Vite</p>
            </div>
            <div style={{ color: saved ? "#86EFAC" : "#CBD5E1", fontWeight: 700 }}>{saved ? "Saved ✓" : "Saved on this device only"}</div>
          </div>
          <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
            {tabs.map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{ border: `1px solid ${tab === t ? "#fff" : "rgba(255,255,255,0.25)"}`, borderRadius: 8, background: tab === t ? "#fff" : "transparent", color: tab === t ? COLORS.header : "#fff", padding: "10px 12px", fontWeight: 800, cursor: "pointer" }}>{t}</button>
            ))}
          </nav>
        </div>
      </header>
      <div style={wrap}>
        {tab === "Dashboard" && <Dashboard state={state} setState={setState} setTab={setTab} narrow={narrow} />}
        {tab === "Setup" && <Setup state={state} update={update} narrow={narrow} />}
        {tab === "Job Compare" && <JobCompare state={state} update={update} narrow={narrow} />}
        {tab === "Edit Scenarios" && <Scenarios state={state} setState={setState} narrow={narrow} />}
        {tab === "Projection" && <Projection state={state} narrow={narrow} />}
        {tab === "AI Advisor" && <AIAdvisor state={state} />}
      </div>
    </main>
  );
}
