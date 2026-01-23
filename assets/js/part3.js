const RESULTS_PATH = '../benchmark_results/part3/'; 
const BENCHMARK_FILES = [
    'results_base_arm64_2025-11-22_23-24-14.json',
    'results_base_x86_64_2025-11-23_03-45-51.json',
    'results_faster_arm64_2025-12-30_19-15-34.json',
    'results_faster_arm64_2026-01-03_00-07-13.json',
    'results_faster_arm64_2026-01-06_22-51-20.json',
    'results_faster_arm64_2026-01-06_22-56-11.json',
    'results_faster_arm64_2026-01-20_03-38-49.json',
    'results_faster_x86_64_2026-01-07_00-24-30.json',
    'results_faster_x86_64_2026-01-24_00-36-48.json',
    'results_parallel-build_arm64_2025-12-29_12-36-21.json',
    'results_parallel-build_x86_64_2026-01-06_23-23-37.json',
    'results_parallel-materialization_arm64_2025-12-30_12-15-00.json',
    'results_parallel-materialization_x86_64_2026-01-06_23-50-58.json',
    'results_parallel-probe_arm64_2026-01-02_23-55-15.json',
    'results_parallel-probe_x86_64_2026-01-07_00-07-21.json',
    'results_serial_arm64_2025-12-05_04-24-09.json',
    'results_serial_x86_64_2025-11-30_16-27-40.json'
];

// Color palettes (replacing D3 color scales)
const COLOR_PALETTE = ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'];
const QUERY_COLOR_PALETTE = ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9d9a', '#9c755f', '#bab0ab'];

function getColor(index, palette) {
    return palette[index % palette.length];
}

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
    charts: {
        totalRuntime: null,
        queryPerf: null,
        pie: null
    }
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', init);

async function init() {
    await loadAllResults();
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
        const app = document.getElementById('app');
        if (app) {
            app.innerHTML = `<div class="text-red-600 p-4 border border-red-300 rounded bg-red-50">Error loading data: ${e.message}</div>`;
        }
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
    const controls = document.getElementById('controls-area');
    if (!controls) return;

    // Architecture
    const archContainer = document.createElement('div');
    archContainer.className = 'bg-white border rounded-lg p-4';
    archContainer.innerHTML = '<h3 class="font-semibold mb-2">Architecture</h3><div id="arch-buttons" class="flex gap-2 flex-wrap"></div>';
    controls.appendChild(archContainer);

    // Algorithms
    const algoContainer = document.createElement('div');
    algoContainer.className = 'bg-white border rounded-lg p-4';
    algoContainer.innerHTML = '<h3 class="font-semibold mb-2">Algorithms</h3><div id="algo-buttons" class="flex gap-2 flex-wrap"></div>';
    controls.appendChild(algoContainer);

    // Comparison Mode
    const modeContainer = document.createElement('div');
    modeContainer.className = 'bg-white border rounded-lg p-4';
    modeContainer.innerHTML = '<h3 class="font-semibold mb-2">Comparison Mode</h3><div id="mode-buttons" class="flex gap-4 pt-2"></div>';
    controls.appendChild(modeContainer);

    ['fastest', 'slowest'].forEach(mode => {
        const label = document.createElement('label');
        label.className = 'inline-flex items-center cursor-pointer';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'compMode';
        input.value = mode;
        input.className = 'form-radio text-blue-600';
        input.checked = state.comparisonMode === mode;
        input.addEventListener('change', (e) => {
            state.comparisonMode = e.target.value;
            updateView();
        });
        const span = document.createElement('span');
        span.className = 'ml-2 capitalize text-sm';
        span.textContent = `Ref: ${mode}`;
        label.appendChild(input);
        label.appendChild(span);
        document.getElementById('mode-buttons').appendChild(label);
    });

    // Versions
    const versionContainer = document.createElement('div');
    versionContainer.className = 'bg-white border rounded-lg p-4';
    versionContainer.innerHTML = '<h3 class="font-semibold mb-2">Active Versions</h3><div id="version-selects" class="space-y-2"></div>';
    controls.appendChild(versionContainer);

    // Table Filters
    const tableFilters = document.getElementById('table-filters');
    if (tableFilters) {
        const sortWrapper = document.createElement('div');
        sortWrapper.innerHTML = '<label class="block text-xs font-bold text-gray-500 mb-1">SORT BY</label>';
        const sortSelect = document.createElement('select');
        sortSelect.className = 'border rounded px-2 py-1 bg-white text-sm';
        sortSelect.addEventListener('change', (e) => {
            state.sortBy = e.target.value;
            state.currentPage = 0;
            renderTable();
        });
        ['absolute', 'percent'].forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v === 'absolute' ? 'Absolute Diff (ms)' : 'Percent Diff (%)';
            sortSelect.appendChild(opt);
        });
        sortWrapper.appendChild(sortSelect);
        tableFilters.appendChild(sortWrapper);

        const pageWrapper = document.createElement('div');
        pageWrapper.innerHTML = '<label class="block text-xs font-bold text-gray-500 mb-1">SHOW</label>';
        const pageSelect = document.createElement('select');
        pageSelect.className = 'border rounded px-2 py-1 bg-white text-sm';
        pageSelect.addEventListener('change', (e) => {
            state.showTop = +e.target.value;
            state.currentPage = 0;
            renderTable();
        });
        [5, 10, 20, 50].forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            if (v === 10) opt.selected = true;
            pageSelect.appendChild(opt);
        });
        pageWrapper.appendChild(pageSelect);
        tableFilters.appendChild(pageWrapper);
    }

    // Pie select initialization
    const pieSelect = document.getElementById('pie-exec-select');
    if (pieSelect) {
        function refreshPieOptions() {
            const execs = state.visibleExecutables.length ? state.visibleExecutables : [...new Set(state.allResults.map(r => r.executable))];
            pieSelect.innerHTML = '';
            if (execs.length > 0 && !state.pieTargetExec) state.pieTargetExec = execs[0];
            execs.forEach(exec => {
                const opt = document.createElement('option');
                opt.value = exec;
                opt.textContent = exec;
                if (exec === state.pieTargetExec) opt.selected = true;
                pieSelect.appendChild(opt);
            });
        }
        pieSelect.addEventListener('change', (e) => {
            state.pieTargetExec = e.target.value;
            renderPieChart();
        });
        refreshPieOptions();
    }
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
    const archButtons = document.getElementById('arch-buttons');
    if (archButtons) {
        archButtons.innerHTML = '';
        archs.forEach(arch => {
            const btn = document.createElement('button');
            btn.className = `px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${state.selectedArchitecture === arch ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`;
            btn.textContent = arch;
            btn.addEventListener('click', () => {
                if (state.selectedArchitecture === arch) return;
                state.selectedArchitecture = arch;
                
                const newSelectedExecutables = {};
                state.visibleExecutables.forEach(exec => {
                    const key = `${exec}_${arch}`;
                    if (state.byExecAndArch[key] && state.byExecAndArch[key].length > 0) {
                        newSelectedExecutables[exec] = state.byExecAndArch[key][0];
                    }
                });
                state.selectedExecutables = newSelectedExecutables;
                updateView();
            });
            archButtons.appendChild(btn);
        });
    }

    // Algorithm Buttons
    const algoButtons = document.getElementById('algo-buttons');
    if (algoButtons) {
        algoButtons.innerHTML = '';
        execs.forEach(exec => {
            const btn = document.createElement('button');
            const isVisible = state.visibleExecutables.includes(exec);
            btn.className = `px-4 py-1.5 text-sm font-medium rounded-full transition-colors border ${isVisible ? 'bg-blue-100 border-blue-400 text-blue-800 shadow-sm' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'}`;
            btn.textContent = exec;
            btn.addEventListener('click', () => {
                if (isVisible) {
                    state.visibleExecutables = state.visibleExecutables.filter(x => x !== exec);
                    delete state.selectedExecutables[exec];
                } else {
                    state.visibleExecutables.push(exec);
                    const res = state.byExecAndArch[`${exec}_${state.selectedArchitecture}`];
                    if(res && res.length) state.selectedExecutables[exec] = res[0];
                }
                updateView();
            });
            algoButtons.appendChild(btn);
        });
    }

    // Version Selects
    const versionContainer = document.getElementById('version-selects');
    if (versionContainer) {
        versionContainer.innerHTML = '';
        state.visibleExecutables.forEach(exec => {
            const row = document.createElement('div');
            row.className = 'version-row border rounded-lg p-2 text-sm bg-gray-50';
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'font-bold mb-1 exec-name';
            nameDiv.textContent = exec;
            nameDiv.style.color = getColor(state.visibleExecutables.indexOf(exec), COLOR_PALETTE);
            row.appendChild(nameDiv);
            
            const select = document.createElement('select');
            select.className = 'w-full border rounded px-2 py-1 bg-white exec-select';
            const results = state.byExecAndArch[`${exec}_${state.selectedArchitecture}`] || [];
            const currentSel = state.selectedExecutables[exec];
            
            results.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.filename;
                opt.textContent = `${r.timestamp.split('_')[0]} (${(r.statistics?.total_runtime?.average/1000).toFixed(2)}s)`;
                if (currentSel && r.filename === currentSel.filename) opt.selected = true;
                select.appendChild(opt);
            });
            
            select.addEventListener('change', (e) => {
                const file = e.target.value;
                const res = state.allResults.find(r => r.filename === file);
                if(res) {
                    state.selectedExecutables[exec] = res;
                    updateView();
                }
            });
            
            row.appendChild(select);
            versionContainer.appendChild(row);
        });
    }

    // Pie select
    const pieSelect = document.getElementById('pie-exec-select');
    if (pieSelect) {
        pieSelect.innerHTML = '';
        const execNames = Object.keys(state.selectedExecutables);
        if (execNames.length > 0 && !state.pieTargetExec) state.pieTargetExec = execNames[0];
        
        execNames.forEach(exec => {
            const opt = document.createElement('option');
            opt.value = exec;
            opt.textContent = exec;
            if (exec === state.pieTargetExec) opt.selected = true;
            pieSelect.appendChild(opt);
        });
        
        pieSelect.addEventListener('change', (e) => {
            state.pieTargetExec = e.target.value;
            renderPieChart();
        });
    }
}

// --- Chart.js Charts ---

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
    const container = document.getElementById('chart-total-runtime');
    if (!container) return;
    
    const data = getTotalRuntimeData();
    if(data.length === 0) {
        container.innerHTML = "<p class='text-gray-400 p-4'>No data selected</p>";
        if (state.charts.totalRuntime) {
            state.charts.totalRuntime.destroy();
            state.charts.totalRuntime = null;
        }
        return;
    }

    const ctx = container.getContext ? container.getContext('2d') : null;
    if (!ctx) {
        const canvas = document.createElement('canvas');
        container.innerHTML = '';
        container.appendChild(canvas);
        const newCtx = canvas.getContext('2d');
        if (state.charts.totalRuntime) state.charts.totalRuntime.destroy();
        
        state.charts.totalRuntime = new Chart(newCtx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.executable),
                datasets: [{
                    label: 'Total Runtime (s)',
                    data: data.map(d => d.value),
                    backgroundColor: data.map(d => d.isRef ? '#22c55e' : getColor(state.visibleExecutables.indexOf(d.executable), COLOR_PALETTE)),
                    borderColor: data.map(d => d.isRef ? '#16a34a' : getColor(state.visibleExecutables.indexOf(d.executable), COLOR_PALETTE)),
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const d = data[context.dataIndex];
                                return [
                                    `Time: ${d.value.toFixed(4)}s`,
                                    d.isRef ? 'Reference' : `Diff: ${d.diff > 0 ? '+' : ''}${d.pDiff.toFixed(2)}%`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { color: '#9ca3af', font: { size: 12 } },
                        grid: { color: '#e5e7eb', opacity: 0.5 }
                    },
                    y: {
                        ticks: { color: '#9ca3af', font: { size: 13 } },
                        grid: { display: false }
                    }
                },
                animation: {
                    duration: 750
                }
            }
        });
        return;
    }

    if (state.charts.totalRuntime) {
        state.charts.totalRuntime.data.labels = data.map(d => d.executable);
        state.charts.totalRuntime.data.datasets[0].data = data.map(d => d.value);
        state.charts.totalRuntime.data.datasets[0].backgroundColor = data.map(d => d.isRef ? '#22c55e' : getColor(state.visibleExecutables.indexOf(d.executable), COLOR_PALETTE));
        state.charts.totalRuntime.data.datasets[0].borderColor = data.map(d => d.isRef ? '#16a34a' : getColor(state.visibleExecutables.indexOf(d.executable), COLOR_PALETTE));
        state.charts.totalRuntime.update();
    }
}

function renderQueryChart() {
    const container = document.getElementById('chart-query-perf');
    if (!container) return;
    
    const analysis = getComparisonData().slice(0, 5);
    if(analysis.length === 0) {
        container.innerHTML = "<p class='text-gray-400 p-4'>No data selected</p>";
        if (state.charts.queryPerf) {
            state.charts.queryPerf.destroy();
            state.charts.queryPerf = null;
        }
        return;
    }

    const ctx = container.getContext ? container.getContext('2d') : null;
    if (!ctx) {
        const canvas = document.createElement('canvas');
        container.innerHTML = '';
        container.appendChild(canvas);
        const newCtx = canvas.getContext('2d');
        if (state.charts.queryPerf) state.charts.queryPerf.destroy();
        
        const subgroups = state.visibleExecutables;
        const groups = analysis.map(d => d.query);
        
        const datasets = subgroups.map((exec, idx) => ({
            label: exec,
            data: analysis.map(d => d.comparisons[exec]?.value || 0),
            backgroundColor: analysis.map(d => d.comparisons[exec]?.isRef ? '#22c55e' : getColor(idx, COLOR_PALETTE)),
            borderColor: analysis.map(d => d.comparisons[exec]?.isRef ? '#16a34a' : getColor(idx, COLOR_PALETTE)),
            borderWidth: 1
        }));
        
        state.charts.queryPerf = new Chart(newCtx, {
            type: 'bar',
            data: {
                labels: groups,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: subgroups.length > 1 },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} ms`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { 
                            color: '#9ca3af', 
                            font: { size: 12 },
                            maxRotation: 35,
                            minRotation: 35
                        },
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#9ca3af', font: { size: 12 } },
                        grid: { color: '#f3f4f6' }
                    }
                },
                animation: {
                    duration: 750
                }
            }
        });
        return;
    }

    if (state.charts.queryPerf) {
        const subgroups = state.visibleExecutables;
        const groups = analysis.map(d => d.query);
        
        state.charts.queryPerf.data.labels = groups;
        state.charts.queryPerf.data.datasets = subgroups.map((exec, idx) => ({
            label: exec,
            data: analysis.map(d => d.comparisons[exec]?.value || 0),
            backgroundColor: analysis.map(d => d.comparisons[exec]?.isRef ? '#22c55e' : getColor(idx, COLOR_PALETTE)),
            borderColor: analysis.map(d => d.comparisons[exec]?.isRef ? '#16a34a' : getColor(idx, COLOR_PALETTE)),
            borderWidth: 1
        }));
        state.charts.queryPerf.update();
    }
}

function renderPieChart() {
    const container = document.getElementById('chart-pie-breakdown');
    const select = document.getElementById('pie-exec-select');
    
    if (!container) return;
    
    const activeExecs = state.visibleExecutables;
    if (activeExecs.length === 0) {
        container.innerHTML = "<div class='text-gray-400 flex h-full items-center justify-center'>No executable selected</div>";
        if (select) select.innerHTML = '';
        if (state.charts.pie) {
            state.charts.pie.destroy();
            state.charts.pie = null;
        }
        return;
    }

    if (!state.pieTargetExec || !activeExecs.includes(state.pieTargetExec)) {
        state.pieTargetExec = activeExecs[0];
    }

    const result = state.selectedExecutables[state.pieTargetExec];
    if (!result || !result.statistics || !result.statistics.per_query) {
        container.innerHTML = "<p class='text-gray-400'>No query data available</p>";
        if (state.charts.pie) {
            state.charts.pie.destroy();
            state.charts.pie = null;
        }
        return;
    }

    const data = Object.entries(result.statistics.per_query)
        .map(([key, stats]) => ({ label: key, value: stats.average }))
        .filter(d => d.value > 0)
        .sort((a, b) => b.value - a.value);

    const ctx = container.getContext ? container.getContext('2d') : null;
    if (!ctx) {
        const canvas = document.createElement('canvas');
        container.innerHTML = '';
        container.appendChild(canvas);
        const newCtx = canvas.getContext('2d');
        if (state.charts.pie) state.charts.pie.destroy();
        
        const totalTime = data.reduce((sum, d) => sum + d.value, 0);
        
        state.charts.pie = new Chart(newCtx, {
            type: 'doughnut',
            data: {
                labels: data.map(d => d.label),
                datasets: [{
                    data: data.map(d => d.value),
                    backgroundColor: data.map((d, idx) => getColor(idx, QUERY_COLOR_PALETTE)),
                    borderColor: 'white',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '55%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label;
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percent = ((value / total) * 100).toFixed(1);
                                return [
                                    `${label}`,
                                    `Time: ${value.toFixed(2)} ms`,
                                    `Share: ${percent}%`
                                ];
                            }
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    duration: 1000
                }
            },
            plugins: [{
                id: 'centerText',
                beforeDraw: function(chart) {
                    const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                    const ctx = chart.ctx;
                    const centerX = chart.chartArea.left + (chart.chartArea.right - chart.chartArea.left) / 2;
                    const centerY = chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top) / 2;
                    
                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = 'bold 14px sans-serif';
                    ctx.fillStyle = '#6b7280';
                    ctx.fillText('Total', centerX, centerY - 10);
                    ctx.font = 'bold 24px monospace';
                    ctx.fillText(`${(total / 1000).toFixed(2)}s`, centerX, centerY + 10);
                    ctx.restore();
                }
            }]
        });
        return;
    }

    if (state.charts.pie) {
        state.charts.pie.data.labels = data.map(d => d.label);
        state.charts.pie.data.datasets[0].data = data.map(d => d.value);
        state.charts.pie.data.datasets[0].backgroundColor = data.map((d, idx) => getColor(idx, QUERY_COLOR_PALETTE));
        state.charts.pie.update();
    }
}

// --- Table Rendering ---

function renderTable() {
    const fullData = getComparisonData();
    const totalPages = Math.ceil(fullData.length / state.showTop);
    
    if (state.currentPage >= totalPages) state.currentPage = Math.max(0, totalPages - 1);
    
    const paginatedData = fullData.slice(state.currentPage * state.showTop, (state.currentPage + 1) * state.showTop);
    const execs = state.visibleExecutables;

    const thead = document.querySelector('#analysis-table thead');
    const tbody = document.querySelector('#analysis-table tbody');
    if (!thead || !tbody) return;

    thead.innerHTML = '';
    const headerRow = document.createElement('tr');
    
    const th1 = document.createElement('th');
    th1.className = 'px-4 py-3 bg-gray-100 border-b';
    th1.textContent = 'Query';
    headerRow.appendChild(th1);
    
    execs.forEach(exec => {
        const th2 = document.createElement('th');
        th2.className = 'px-4 py-3 bg-gray-50 border-l border-gray-200 border-b text-right';
        th2.style.color = getColor(state.visibleExecutables.indexOf(exec), COLOR_PALETTE);
        th2.innerHTML = `${exec}<br><span class="text-[10px] text-gray-400 font-normal">Time (ms)</span>`;
        headerRow.appendChild(th2);
        
        const th3 = document.createElement('th');
        th3.className = 'px-4 py-3 bg-gray-50 border-b text-right w-24';
        th3.innerHTML = `<span class="text-[10px] text-gray-400 font-normal">vs Ref</span>`;
        headerRow.appendChild(th3);
    });
    
    thead.appendChild(headerRow);

    tbody.innerHTML = '';
    paginatedData.forEach(d => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors group';
        
        const td1 = document.createElement('td');
        td1.className = 'px-4 py-3 font-mono text-gray-700 font-medium border-b border-gray-100';
        td1.textContent = d.query;
        row.appendChild(td1);
        
        execs.forEach(exec => {
            const comp = d.comparisons[exec];
            
            const td2 = document.createElement('td');
            td2.className = `px-4 py-3 text-right border-l border-gray-100 border-b ${comp.isRef ? 'font-bold text-green-600' : 'text-gray-700'}`;
            td2.textContent = comp.value !== null ? comp.value.toFixed(1) : '-';
            row.appendChild(td2);

            const td3 = document.createElement('td');
            td3.className = 'px-4 py-3 text-right border-b border-gray-100 text-xs';
            
            if (comp.isRef) {
                td3.innerHTML = '<span class="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-[10px] font-bold">REF</span>';
            } else if (comp.diff !== null) {
                const isBad = state.comparisonMode === 'fastest' ? comp.diff > 0 : comp.diff < 0;
                const colorClass = isBad ? 'text-red-600' : 'text-green-600';
                const sign = comp.diff > 0 ? '+' : '';
                td3.className = `px-4 py-3 text-right border-b border-gray-100 text-xs font-semibold ${colorClass}`;
                td3.innerHTML = `${sign}${comp.diff.toFixed(1)} <span class="opacity-75">(${sign}${comp.pDiff.toFixed(0)}%)</span>`;
            } else {
                td3.textContent = '-';
            }
            row.appendChild(td3);
        });
        
        tbody.appendChild(row);
    });

    const pageControls = document.getElementById('pagination-controls');
    if (pageControls) {
        pageControls.innerHTML = '';
        
        const prevBtn = document.createElement('button');
        prevBtn.className = 'px-3 py-1.5 text-xs font-medium border rounded bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors';
        prevBtn.disabled = state.currentPage === 0;
        prevBtn.textContent = 'Previous';
        prevBtn.addEventListener('click', () => {
            state.currentPage--;
            renderTable();
        });
        pageControls.appendChild(prevBtn);
        
        const span = document.createElement('span');
        span.className = 'text-xs text-gray-500 font-medium';
        span.textContent = `Page ${state.currentPage + 1} of ${totalPages || 1}`;
        pageControls.appendChild(span);
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'px-3 py-1.5 text-xs font-medium border rounded bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors';
        nextBtn.disabled = state.currentPage >= totalPages - 1;
        nextBtn.textContent = 'Next';
        nextBtn.addEventListener('click', () => {
            state.currentPage++;
            renderTable();
        });
        pageControls.appendChild(nextBtn);
    }
}
