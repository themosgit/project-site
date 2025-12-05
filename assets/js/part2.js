const RESULTS_PATH = '../benchmark_results/part2/'; 
const BENCHMARK_FILES = [
    'results_column_t_arm64_2025-11-25_03-23-47.json',
    'results_column_t_arm64_2025-11-26_22-35-31.json',
    'results_column_t_x86_64_2025-11-26_19-02-11.json',
    'results_column_t_x86_64_2025-11-26_22-32-51.json',
    'results_fast_arm64_2025-11-22_23-24-14.json',
    'results_fast_x86_64_2025-11-23_03-45-51.json',
    'results_faster_arm64_2025-11-27_20-53-31.json',
    'results_faster_arm64_2025-11-27_23-53-43.json',
    'results_faster_arm64_2025-11-28_02-29-28.json',
    'results_faster_arm64_2025-11-28_03-25-03.json',
    'results_faster_arm64_2025-11-28_12-34-59.json',
    'results_faster_arm64_2025-11-30_16-24-50.json',
    'results_faster_arm64_2025-12-04_18-07-24.json',
    'results_faster_arm64_2025-12-05_03-53-02.json',
    'results_faster_arm64_2025-12-05_04-24-09.json',
    'results_faster_x86_64_2025-11-27_20-19-59.json',
    'results_faster_x86_64_2025-11-28_00-14-48.json',
    'results_faster_x86_64_2025-11-28_02-27-42.json',
    'results_faster_x86_64_2025-11-28_03-26-31.json',
    'results_faster_x86_64_2025-11-28_12-59-52.json',
    'results_faster_x86_64_2025-11-28_16-37-49.json',
    'results_faster_x86_64_2025-11-30_16-27-40.json',
    'results_unchained_arm64_2025-11-27_02-20-36.json',
    'results_unchained_arm64_2025-11-27_03-09-13.json',
    'results_unchained_x86_64_2025-11-27_01-57-36.json',
    'results_value_t_arm64_2025-11-22_23-24-14.json',
    'results_value_t_x86_64_2025-11-23_03-45-51.json'
];

const state = {
    allResults: [],
    byExecAndArch: {},
    selectedExecutables: {},
    selectedArchitecture: 'arm64',
    visibleExecutables: [],
    comparisonMode: 'fastest',
    sortBy: 'absolute',
    showTop: 10,
    currentPage: 0,
    pieTargetExec: null, 
    colorScale: d3.scaleOrdinal(d3.schemeSet2),
    queryColorScale: d3.scaleOrdinal(d3.schemeTableau10) 
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', init);

async function init() {
    createTooltip();
    await loadAllResults();
}

function createTooltip() {
    d3.select("body").append("div")
        .attr("class", "d3-tooltip")
        .style("opacity", 0);
}

async function loadAllResults() {
    try {
        const links = BENCHMARK_FILES.filter(href => href.endsWith('.json'));
        const allData = await Promise.all(
            links.map(async (file) => {
                const res = await fetch(`${RESULTS_PATH}${file}`);
                if (!res.ok) throw new Error(`Failed: ${file}`);
                const data = await res.json();
                return { filename: file, ...data };
            })
        );
        state.allResults = allData;
        processResults();
        initUI();
        updateView();
    } catch (e) {
        d3.select("#app").html(`<div class="text-red-600 p-4 border border-red-300 rounded bg-red-50">Error loading data: ${e.message}</div>`);
    }
}

function processResults() {
    const byExecAndArch = {};
    state.allResults.forEach(result => {
        const key = `${result.executable}_${result.architecture}`;
        if (!byExecAndArch[key]) byExecAndArch[key] = [];
        byExecAndArch[key].push(result);
    });

    Object.keys(byExecAndArch).forEach(key => {
        byExecAndArch[key].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    });
    
    state.byExecAndArch = byExecAndArch;

    if (Object.keys(state.selectedExecutables).length === 0) {
        const defaultExec = 'fast';
        const availableArchs = [...new Set(state.allResults.map(r => r.architecture))];
        if(availableArchs.includes('arm64')) state.selectedArchitecture = 'arm64';
        
        const archResults = byExecAndArch[`${defaultExec}_${state.selectedArchitecture}`];
        if (archResults && archResults.length > 0) {
            state.selectedExecutables[defaultExec] = archResults[0];
            state.visibleExecutables = [defaultExec];
        } else {
            const firstKey = Object.keys(byExecAndArch).find(k => k.includes(state.selectedArchitecture));
            if(firstKey) {
                const exec = firstKey.split('_')[0];
                state.selectedExecutables[exec] = byExecAndArch[firstKey][0];
                state.visibleExecutables = [exec];
            }
        }
    }
}

// --- Data Logic ---

function getComparisonData() {
    const selectedExecs = Object.values(state.selectedExecutables);
    if (selectedExecs.length === 0) return [];

    const allQueries = new Set();
    selectedExecs.forEach(exec => {
        if (exec.statistics?.per_query) Object.keys(exec.statistics.per_query).forEach(q => allQueries.add(q));
    });

    const rows = [];
    allQueries.forEach(query => {
        let refVal = null;
        let refExec = null;
        selectedExecs.forEach(res => {
            const val = res.statistics?.per_query?.[query]?.average;
            if (val !== undefined) {
                if (refVal === null) { refVal = val; refExec = res.executable; }
                else if (state.comparisonMode === 'fastest' && val < refVal) { refVal = val; refExec = res.executable; }
                else if (state.comparisonMode === 'slowest' && val > refVal) { refVal = val; refExec = res.executable; }
            }
        });

        if (refVal === null) return;

        const comparisons = {};
        selectedExecs.forEach(res => {
            const val = res.statistics?.per_query?.[query]?.average;
            if (val !== undefined) {
                const diff = val - refVal;
                const pDiff = refVal === 0 ? 0 : (diff / refVal) * 100;
                comparisons[res.executable] = { value: val, diff, pDiff, isRef: res.executable === refExec };
            } else {
                comparisons[res.executable] = { value: null };
            }
        });

        rows.push({ query, refVal, refExec, comparisons });
    });
    
    return rows.sort((a, b) => {
        const getMaxDiff = (row) => {
            const diffs = Object.values(row.comparisons).filter(c => !c.isRef && c.diff !== undefined).map(c => state.sortBy === 'absolute' ? c.diff : c.pDiff);
            if (diffs.length === 0) return 0;
            return state.comparisonMode === 'fastest' ? Math.max(0, ...diffs) : Math.min(0, ...diffs);
        };
        return getMaxDiff(b) - getMaxDiff(a);
    });
}

function getTotalRuntimeData() {
    const data = [];
    let refVal = null;
    let refExec = null;

    Object.values(state.selectedExecutables).forEach(res => {
        const val = res.statistics?.total_runtime?.average ? res.statistics.total_runtime.average / 1000 : null;
        if (val !== null) {
            data.push({ executable: res.executable, value: val });
            if (refVal === null) { refVal = val; refExec = res.executable; }
            else if (state.comparisonMode === 'fastest' && val < refVal) { refVal = val; refExec = res.executable; }
            else if (state.comparisonMode === 'slowest' && val > refVal) { refVal = val; refExec = res.executable; }
        }
    });

    return data.map(d => ({
        ...d,
        isRef: d.executable === refExec,
        diff: d.value - refVal,
        pDiff: refVal === 0 ? 0 : ((d.value - refVal) / refVal) * 100
    })).sort((a, b) => a.value - b.value);
}

// --- UI Rendering ---

function initUI() {
    const controls = d3.select("#controls-area");

    // Architecture
    const archContainer = controls.append("div").attr("class", "bg-white border rounded-lg p-4");
    archContainer.append("h3").attr("class", "font-semibold mb-2").text("Architecture");
    archContainer.append("div").attr("id", "arch-buttons").attr("class", "flex gap-2 flex-wrap");

    // Algorithms
    const algoContainer = controls.append("div").attr("class", "bg-white border rounded-lg p-4");
    algoContainer.append("h3").attr("class", "font-semibold mb-2").text("Algorithms");
    algoContainer.append("div").attr("id", "algo-buttons").attr("class", "flex gap-2 flex-wrap");

    // Comparison Mode
    const modeContainer = controls.append("div").attr("class", "bg-white border rounded-lg p-4");
    modeContainer.append("h3").attr("class", "font-semibold mb-2").text("Comparison Mode");
    const modeDiv = modeContainer.append("div").attr("class", "flex gap-4 pt-2");
    
    ['fastest', 'slowest'].forEach(mode => {
        const label = modeDiv.append("label").attr("class", "inline-flex items-center cursor-pointer");
        label.append("input")
            .attr("type", "radio")
            .attr("name", "compMode")
            .attr("value", mode)
            .attr("class", "form-radio text-blue-600")
            .property("checked", state.comparisonMode === mode)
            .on("change", (e) => { state.comparisonMode = e.target.value; updateView(); });
        label.append("span").attr("class", "ml-2 capitalize text-sm").text(`Ref: ${mode}`);
    });

    // Versions
    const versionContainer = controls.append("div").attr("class", "bg-white border rounded-lg p-4");
    versionContainer.append("h3").attr("class", "font-semibold mb-2").text("Active Versions");
    versionContainer.append("div").attr("id", "version-selects").attr("class", "space-y-2");

    // Table Filters
    const tableFilters = d3.select("#table-filters");
    const sortWrapper = tableFilters.append("div");
    sortWrapper.append("label").attr("class", "block text-xs font-bold text-gray-500 mb-1").text("SORT BY");
    sortWrapper.append("select")
        .attr("class", "border rounded px-2 py-1 bg-white text-sm")
        .on("change", (e) => { state.sortBy = e.target.value; state.currentPage = 0; renderTable(); })
        .selectAll("option")
        .data([{v: 'absolute', t: 'Absolute Diff (ms)'}, {v: 'percent', t: 'Percent Diff (%)'}])
        .enter().append("option").attr("value", d => d.v).text(d => d.t);

    const pageWrapper = tableFilters.append("div");
    pageWrapper.append("label").attr("class", "block text-xs font-bold text-gray-500 mb-1").text("SHOW");
    pageWrapper.append("select")
        .attr("class", "border rounded px-2 py-1 bg-white text-sm")
        .on("change", (e) => { state.showTop = +e.target.value; state.currentPage = 0; renderTable(); })
        .selectAll("option")
        .data([5, 10, 20, 50])
        .enter().append("option").attr("value", d => d).text(d => d);

    // Populate pie select initially and wire handler
    const pieSelect = d3.select("#pie-exec-select");
    function refreshPieOptions() {
        const execs = state.visibleExecutables.length ? state.visibleExecutables : [...new Set(state.allResults.map(r => r.executable))];
        pieSelect.html("");
        if (execs.length > 0 && !state.pieTargetExec) state.pieTargetExec = execs[0];
        const opts = pieSelect.selectAll("option").data(execs);
        opts.enter().append("option").merge(opts)
            .attr("value", d => d)
            .property("selected", d => d === state.pieTargetExec)
            .text(d => d);
        opts.exit().remove();
    }
    pieSelect.on("change", (e) => {
        state.pieTargetExec = e.target.value;
        renderPieChart();
    });

    // ensure initial options
    refreshPieOptions();
}

function updateView() {
    renderControls();
    renderTotalRuntimeChart();
    renderQueryChart();
    renderPieChart();
    renderTable();
}

function renderControls() {
    const archs = [...new Set(state.allResults.map(r => r.architecture))];
    const execs = [...new Set(state.allResults.map(r => r.executable))];

    // Architecture Buttons
    d3.select("#arch-buttons").selectAll("button")
        .data(archs)
        .join("button")
        .attr("class", d => `px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${state.selectedArchitecture === d ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`)
        .text(d => d)
        .on("click", (e, d) => {
                        if (state.selectedArchitecture === d) return; // Do nothing if it's the same arch
            state.selectedArchitecture = d;
            
            // Reset and re-select executables for the new architecture
            const newSelectedExecutables = {};
            state.visibleExecutables.forEach(exec => {
                const key = `${exec}_${d}`;
                if (state.byExecAndArch[key] && state.byExecAndArch[key].length > 0) {
                    newSelectedExecutables[exec] = state.byExecAndArch[key][0]; // Select the latest one
                }
            });
            state.selectedExecutables = newSelectedExecutables;

            updateView();
        });

    // Algorithm Buttons
    d3.select("#algo-buttons").selectAll("button")
        .data(execs)
        .join("button")
        .attr("class", d => `px-4 py-1.5 text-sm font-medium rounded-full transition-colors border ${state.visibleExecutables.includes(d) ? 'bg-blue-100 border-blue-400 text-blue-800 shadow-sm' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'}`)
        .text(d => d)
        .on("click", (e, d) => {
            if (state.visibleExecutables.includes(d)) {
                state.visibleExecutables = state.visibleExecutables.filter(x => x !== d);
                delete state.selectedExecutables[d];
            } else {
                state.visibleExecutables.push(d);
                const res = state.byExecAndArch[`${d}_${state.selectedArchitecture}`];
                if(res && res.length) state.selectedExecutables[d] = res[0];
            }
            updateView();
        });

    // Version Selects
    const versionContainer = d3.select("#version-selects");
    const versionDivs = versionContainer.selectAll(".version-row")
        .data(state.visibleExecutables, d => d);

    versionDivs.exit().remove();

    const versionEnter = versionDivs.enter().append("div")
        .attr("class", "version-row border rounded-lg p-2 text-sm bg-gray-50");
    
    versionEnter.append("div").attr("class", "font-bold mb-1 exec-name");
    versionEnter.append("select").attr("class", "w-full border rounded px-2 py-1 bg-white exec-select")
        .on("change", (e, d) => {
            const file = e.target.value;
            const res = state.allResults.find(r => r.filename === file);
            if(res) { state.selectedExecutables[d] = res; updateView(); }
        });

    versionContainer.selectAll(".version-row").each(function(exec) {
        const row = d3.select(this);
        row.select(".exec-name").text(exec).style("color", state.colorScale(exec));
        
        const results = state.byExecAndArch[`${exec}_${state.selectedArchitecture}`] || [];
        const currentSel = state.selectedExecutables[exec];

        const options = row.select("select").selectAll("option").data(results, r => r.filename);
        options.enter().append("option").merge(options)
            .attr("value", r => r.filename)
            .property("selected", r => currentSel && r.filename === currentSel.filename)
            .text(r => `${r.timestamp.split('_')[0]} (${(r.statistics?.total_runtime?.average/1000).toFixed(2)}s)`);
        options.exit().remove();
    });

    // refresh pie-select options when controls change
    if (typeof refreshPieOptions === 'function') refreshPieOptions();
}

// --- D3 Charts ---

// Window Resize Listener for Responsive Charts
window.addEventListener('resize', () => {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(() => {
        renderTotalRuntimeChart();
        renderQueryChart();
        renderPieChart();
    }, 250);
});

function renderTotalRuntimeChart() {
    const container = d3.select("#chart-total-runtime");
    container.html("");
    const data = getTotalRuntimeData();
    if(data.length === 0) { container.html("<p class='text-gray-400 p-4'>No data selected</p>"); return; }

    const containerWidth = container.node().getBoundingClientRect().width;
    const isMobile = containerWidth < 500;

    const margin = isMobile 
        ? {top: 20, right: 20, bottom: 20, left: 10}
        : {top: 20, right: 50, bottom: 30, left: 120}; 

    const width = containerWidth - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value) * (isMobile ? 1.3 : 1.15)])
        .range([0, width]);

    const y = d3.scaleBand()
        .range([0, height])
        .domain(data.map(d => d.executable))
        .padding(isMobile ? 0.4 : 0.3);

    // Bars
    svg.selectAll("rect")
        .data(data)
        .join("rect")
        .attr("x", x(0))
        .attr("y", d => y(d.executable))
        .attr("height", y.bandwidth())
        .attr("fill", d => d.isRef ? "#22c55e" : state.colorScale(d.executable))
        .attr("rx", 4)
        .attr("width", 0)
        .transition().duration(750)
        .attr("width", d => x(d.value));

    // Labels logic
    if (isMobile) {
        // Mobile: Labels ABOVE bars
        svg.selectAll(".label-name")
            .data(data)
            .join("text")
            .attr("class", "text-xs font-bold fill-current text-gray-700 dark:text-gray-500")
            .attr("x", x(0))
            .attr("y", d => y(d.executable) - 5)
            .text(d => d.executable);
        
        svg.selectAll(".label-val")
            .data(data)
            .join("text")
            .attr("class", "text-xs font-medium fill-current text-gray-600 dark:text-gray-300")
            .attr("x", d => x(d.value) + 5)
            .attr("y", d => y(d.executable) + y.bandwidth() / 2 + 4)
            .text(d => {
                if (d.isRef) return `${d.value.toFixed(2)}s`;
                const sign = d.pDiff > 0 ? '+' : '';
                return `${d.value.toFixed(2)}s (${sign}${d.pDiff.toFixed(0)}%)`;
            });

    } else {
        // Desktop: Labels on Left
        svg.append("g")
            .call(d3.axisLeft(y).tickSize(0))
            .style("font-size", "13px")
            .select(".domain").remove();

        svg.selectAll(".label-val")
            .data(data)
            .join("text")
            .attr("class", "label-val text-xs font-medium fill-current text-gray-700 dark:text-gray-500")
            .attr("x", d => x(d.value) + 8)
            .attr("y", d => y(d.executable) + y.bandwidth() / 2 + 4)
            .text(d => {
                if (d.isRef) return `${d.value.toFixed(2)}s`;
                const sign = d.pDiff > 0 ? '+' : '';
                return `${d.value.toFixed(2)}s (${sign}${d.pDiff.toFixed(0)}%)`;
            });
    }

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(isMobile ? 3 : 5)).style("color", "#9ca3af").select(".domain").remove();
    
    // Grid lines
    svg.append("g").attr("class", "grid-lines").call(d3.axisBottom(x).ticks(isMobile ? 3 : 5).tickSize(height).tickFormat("")).style("color", "#e5e7eb").style("opacity", 0.5).select(".domain").remove();

    const tooltip = d3.select(".d3-tooltip");
    svg.selectAll("rect")
        .on("mouseover", (e, d) => {
            tooltip.transition().duration(200).style("opacity", .9);
            tooltip.html(`<strong>${d.executable}</strong><br/>Time: ${d.value.toFixed(4)}s<br/>${d.isRef ? '<span class="text-green-400">Reference</span>' : `Diff: ${d.diff > 0 ? '+' : ''}${d.pDiff.toFixed(2)}%`}`)
                .style("left", (e.pageX + 10) + "px")
                .style("top", (e.pageY - 28) + "px");
        })
        .on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0));
}

function renderQueryChart() {
    const container = d3.select("#chart-query-perf");
    container.html("");
    const analysis = getComparisonData().slice(0, 5);
    if(analysis.length === 0) { container.html("<p class='text-gray-400 p-4'>No data selected</p>"); return; }

    const containerWidth = container.node().getBoundingClientRect().width;
    const isMobile = containerWidth < 500;

    const margin = isMobile
        ? {top: 20, right: 10, bottom: 50, left: 35} 
        : {top: 20, right: 20, bottom: 60, left: 60};

    const width = containerWidth - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const subgroups = state.visibleExecutables;
    const groups = analysis.map(d => d.query);

    const x = d3.scaleBand().domain(groups).range([0, width]).padding(0.25);
    const xSub = d3.scaleBand().domain(subgroups).range([0, x.bandwidth()]).padding(isMobile ? 0.05 : 0.1);
    
    const maxY = d3.max(analysis, d => d3.max(subgroups, sub => d.comparisons[sub]?.value || 0));
    const y = d3.scaleLinear().domain([0, maxY]).range([height, 0]);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-35)")
        .style("font-size", isMobile ? "10px" : "12px");

    svg.append("g").call(d3.axisLeft(y).ticks(5)).style("color", "#9ca3af").style("font-size", isMobile ? "10px" : "12px").select(".domain").remove();
    svg.append("g").attr("class", "grid-lines").call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat("")).style("color", "#f3f4f6").select(".domain").remove();

    svg.append("g")
        .selectAll("g")
        .data(analysis)
        .join("g")
        .attr("transform", d => `translate(${x(d.query)},0)`)
        .selectAll("rect")
        .data(d => subgroups.map(key => ({key: key, value: d.comparisons[key]?.value, isRef: d.comparisons[key]?.isRef})))
        .join("rect")
        .attr("x", d => xSub(d.key))
        .attr("y", height)
        .attr("width", xSub.bandwidth())
        .attr("height", 0)
        .attr("fill", d => d.isRef ? "#22c55e" : state.colorScale(d.key))
        .attr("rx", isMobile ? 1 : 2)
        .transition().duration(750)
        .attr("y", d => y(d.value || 0))
        .attr("height", d => height - y(d.value || 0));

    const tooltip = d3.select(".d3-tooltip");
    svg.selectAll("rect")
        .on("mouseover", (e, d) => {
            if(!d.value) return;
            tooltip.transition().duration(200).style("opacity", .9);
            tooltip.html(`<strong>${d.key}</strong><br/>${d.value.toFixed(2)} ms`)
                .style("left", (e.pageX + 10) + "px")
                .style("top", (e.pageY - 28) + "px");
        })
        .on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0));
}

function renderPieChart() {
    const container = d3.select("#chart-pie-breakdown");
    const select = d3.select("#pie-exec-select");
    
    const activeExecs = state.visibleExecutables;
    if (activeExecs.length === 0) {
        container.html("<div class='text-gray-400 flex h-full items-center justify-center'>No executable selected</div>");
        select.html("");
        return;
    }

    if (!state.pieTargetExec || !activeExecs.includes(state.pieTargetExec)) {
        state.pieTargetExec = activeExecs[0];
    }

    const options = select.selectAll("option").data(activeExecs);
    options.enter().append("option").merge(options)
        .text(d => d)
        .attr("value", d => d)
        .property("selected", d => d === state.pieTargetExec);
    options.exit().remove();

    select.on("change", function() {
        state.pieTargetExec = this.value;
        renderPieChart();
    });

    const result = state.selectedExecutables[state.pieTargetExec];
    if (!result || !result.statistics || !result.statistics.per_query) {
        container.html("<p class='text-gray-400'>No query data available</p>");
        return;
    }

    const data = Object.entries(result.statistics.per_query)
        .map(([key, stats]) => ({ label: key, value: stats.average }))
        .filter(d => d.value > 0)
        .sort((a, b) => b.value - a.value);

    container.html("");

    const width = 600;
    const height = 500;
    const margin = 40;
    const radius = Math.min(width, height) / 2 - margin;

    const svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.55).outerRadius(radius * 0.85);
    const arcHover = d3.arc().innerRadius(radius * 0.55).outerRadius(radius * 0.9);

    const paths = svg.selectAll("path")
        .data(pie(data))
        .join("path")
        .attr("d", arc)
        .attr("fill", d => state.queryColorScale(d.data.label))
        .attr("stroke", "white")
        .style("stroke-width", "2px")
        .style("cursor", "pointer")
        .each(function(d) { this._current = d; }); 

    paths.transition().duration(1000)
        .attrTween("d", function(d) {
            const i = d3.interpolate({startAngle: 0, endAngle: 0}, d);
            return function(t) { return arc(i(t)); };
        });

    // Center Text
    const totalTime = d3.sum(data, d => d.value);
    const centerGroup = svg.append("text")
        .attr("text-anchor", "middle")
        .attr("class", "fill-current text-gray-700  dark:text-gray-500");

    centerGroup.append("tspan")
        .attr("dy", "-0.2em")
        .attr("x", 0)
        .attr("class", "text-lg font-semibold uppercase tracking-widest opacity-60")
        .text("Total");
        
    centerGroup.append("tspan")
        .attr("dy", "1.2em")
        .attr("x", 0)
        .attr("class", "text-3xl font-bold font-mono")
        .text(`${(totalTime / 1000).toFixed(2)}s`);

    // Tooltip
    const tooltip = d3.select(".d3-tooltip");
    paths.on("mouseover", function(e, d) {
            d3.select(this).transition().duration(200).attr("d", arcHover).style("filter", "drop-shadow(0px 3px 3px rgba(0,0,0,0.2))");
            const percent = ((d.endAngle - d.startAngle) / (2 * Math.PI) * 100).toFixed(1);
            
            tooltip.style("opacity", 0.95);
            tooltip.html(`
                <div class="font-bold mb-1 text-sm border-b border-gray-600 pb-1">${d.data.label}</div>
                <div class="flex justify-between gap-4 text-xs"><span>Time:</span> <span class="font-mono">${d.data.value.toFixed(2)} ms</span></div>
                <div class="flex justify-between gap-4 text-xs"><span>Share:</span> <span class="font-mono text-blue-300">${percent}%</span></div>
            `)
            .style("left", (e.pageX + 15) + "px")
            .style("top", (e.pageY - 28) + "px");
        })
        .on("mouseout", function(e, d) {
            d3.select(this).transition().duration(200).attr("d", arc).style("filter", "none");
            tooltip.style("opacity", 0);
        });

    // Labels on Pie
    svg.selectAll("text.slice-label")
        .data(pie(data))
        .join("text")
        .attr("transform", d => `translate(${arc.centroid(d)})`)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text(d => (d.endAngle - d.startAngle > 0.25) ? (d.data.label.length > 10 ? d.data.label.slice(0,8)+".." : d.data.label) : "")
        .style("font-size", "10px")
        .style("fill", "white")
        .style("font-weight", "bold")
        .style("pointer-events", "none")
        .style("text-shadow", "0px 1px 2px rgba(0,0,0,0.5)");
}

// --- Table Rendering ---

function renderTable() {
    const fullData = getComparisonData();
    const totalPages = Math.ceil(fullData.length / state.showTop);
    
    if (state.currentPage >= totalPages) state.currentPage = Math.max(0, totalPages - 1);
    
    const paginatedData = fullData.slice(state.currentPage * state.showTop, (state.currentPage + 1) * state.showTop);
    const execs = state.visibleExecutables;

    const thead = d3.select("#analysis-table thead");
    thead.html("");
    const headerRow = thead.append("tr");
    
    headerRow.append("th").attr("class", "px-4 py-3 bg-gray-100 border-b").text("Query");
    
    execs.forEach(exec => {
        headerRow.append("th")
            .attr("class", "px-4 py-3 bg-gray-50 border-l border-gray-200 border-b text-right")
            .style("color", state.colorScale(exec))
            .html(`${exec}<br><span class="text-[10px] text-gray-400 font-normal">Time (ms)</span>`);
        
        headerRow.append("th")
            .attr("class", "px-4 py-3 bg-gray-50 border-b text-right w-24")
            .html(`<span class="text-[10px] text-gray-400 font-normal">vs Ref</span>`);
    });

    const tbody = d3.select("#analysis-table tbody");
    const rows = tbody.selectAll("tr").data(paginatedData, d => d.query);
    rows.exit().remove();

    const rowsEnter = rows.enter().append("tr").attr("class", "hover:bg-gray-50 transition-colors group");
    const allRows = rowsEnter.merge(rows);
    allRows.html("");

    allRows.append("td")
        .attr("class", "px-4 py-3 font-mono text-gray-700 font-medium border-b border-gray-100")
        .text(d => d.query);

    allRows.each(function(d) {
        const row = d3.select(this);
        execs.forEach(exec => {
            const comp = d.comparisons[exec];
            
            row.append("td")
                .attr("class", `px-4 py-3 text-right border-l border-gray-100 border-b ${comp.isRef ? 'font-bold text-green-600' : 'text-gray-700'}`)
                .text(comp.value !== null ? comp.value.toFixed(1) : '-');

            const diffCell = row.append("td")
                .attr("class", "px-4 py-3 text-right border-b border-gray-100 text-xs");
            
            if (comp.isRef) {
                diffCell.html('<span class="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-[10px] font-bold">REF</span>');
            } else if (comp.diff !== null) {
                const isBad = state.comparisonMode === 'fastest' ? comp.diff > 0 : comp.diff < 0;
                const colorClass = isBad ? "text-red-600" : "text-green-600";
                const sign = comp.diff > 0 ? "+" : "";
                diffCell.attr("class", `px-4 py-3 text-right border-b border-gray-100 text-xs font-semibold ${colorClass}`)
                    .html(`${sign}${comp.diff.toFixed(1)} <span class="opacity-75">(${sign}${comp.pDiff.toFixed(0)}%)</span>`);
            } else {
                diffCell.text("-");
            }
        });
    });

    const pageControls = d3.select("#pagination-controls");
    pageControls.html("");
    
    pageControls.append("button")
        .attr("class", "px-3 py-1.5 text-xs font-medium border rounded bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors")
        .property("disabled", state.currentPage === 0)
        .text("Previous")
        .on("click", () => { state.currentPage--; renderTable(); });

    pageControls.append("span")
        .attr("class", "text-xs text-gray-500 font-medium")
        .text(`Page ${state.currentPage + 1} of ${totalPages || 1}`);

    pageControls.append("button")
        .attr("class", "px-3 py-1.5 text-xs font-medium border rounded bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors")
        .property("disabled", state.currentPage >= totalPages - 1)
        .text("Next")
        .on("click", () => { state.currentPage++; renderTable(); });
}
