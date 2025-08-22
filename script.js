// ----- Tabs logic -----
const tab1 = document.getElementById('tab1');
const tab2 = document.getElementById('tab2');
const panel1 = document.getElementById('csvGen');
const panel2 = document.getElementById('csvToArb');

function selectTab(which) {
  const sel1 = which === 1;
  tab1.setAttribute('aria-selected', sel1);
  tab2.setAttribute('aria-selected', !sel1);
  panel1.hidden = !sel1;
  panel2.hidden = sel1;
}

tab1.addEventListener('click', () => selectTab(1));
tab2.addEventListener('click', () => selectTab(2));

// Keyboard nav for tabs
document.querySelectorAll('[role="tab"]').forEach((btn, idx, arr) => {
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') arr[(idx+1)%arr.length].focus();
    if (e.key === 'ArrowLeft') arr[(idx-1+arr.length)%arr.length].focus();
  });
});

// ----- Custom Language List for Target Languages -----
const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'ur', name: 'Urdu' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ar', name: 'Arabic' },
];

const targetLangsList = document.getElementById('targetLangsList');
const targetLangSearch = document.getElementById('targetLangSearch');
let selectedLangs = [];
let filteredLangs = LANGUAGES.slice();

function renderLangList() {
  let html = '';
  // Select All row
  const allSelected = filteredLangs.length > 0 && filteredLangs.every(l => selectedLangs.includes(l.code));
  html += `<div class="lang-row select-all${allSelected ? ' selected' : ''}" data-select-all="1">
    <span class="lang-tick">${allSelected ? tickSvg() : ''}</span>
    <span class="lang-label">Select All</span>
  </div>`;
  // Language rows
  filteredLangs.forEach(lang => {
    const isSelected = selectedLangs.includes(lang.code);
    html += `<div class="lang-row${isSelected ? ' selected' : ''}" data-code="${lang.code}">
      <span class="lang-tick">${isSelected ? tickSvg() : ''}</span>
      <span class="lang-label">${lang.name} (${lang.code})</span>
    </div>`;
  });
  targetLangsList.innerHTML = html;
}

function tickSvg() {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 8.5L7 11.5L12 5.5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// Handle click on language rows
if (targetLangsList) {
  targetLangsList.addEventListener('click', (e) => {
    const row = e.target.closest('.lang-row');
    if (!row) return;
    if (row.hasAttribute('data-select-all')) {
      // Select All logic
      const allSelected = filteredLangs.length > 0 && filteredLangs.every(l => selectedLangs.includes(l.code));
      if (allSelected) {
        // Unselect all filtered
        selectedLangs = selectedLangs.filter(code => !filteredLangs.some(l => l.code === code));
      } else {
        // Select all filtered
        filteredLangs.forEach(l => {
          if (!selectedLangs.includes(l.code)) selectedLangs.push(l.code);
        });
      }
    } else {
      const code = row.getAttribute('data-code');
      if (!code) return;
      if (selectedLangs.includes(code)) {
        selectedLangs = selectedLangs.filter(c => c !== code);
      } else {
        selectedLangs.push(code);
      }
    }
    renderLangList();
  });
}

// Handle search
if (targetLangSearch) {
  targetLangSearch.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    filteredLangs = LANGUAGES.filter(l => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q));
    renderLangList();
  });
}

// Initial render
renderLangList();

// ----- CSV Generator (updated for custom lang list) -----
document.getElementById('downloadCsvBtn').addEventListener('click', () => {
  const baseLang = document.getElementById('baseLang').value;
  // Use selectedLangs instead of <select>
  const targetLangs = selectedLangs.filter(l => l !== baseLang);

  if (targetLangs.length === 0) {
    alert('Please select at least one target language');
    return;
  }

  const keys = ["greeting"]; // default seed key

  const header = ["key", baseLang, ...targetLangs];
  const rows = [header];

  keys.forEach((key, i) => {
    const rowIndex = i + 2; // CSV row for formulas
    const row = [key, ""]; // base left blank
    targetLangs.forEach(lang => {
      row.push(`=GOOGLETRANSLATE($B${rowIndex};"${baseLang}";"${lang}")`);
    });
    rows.push(row);
  });

  const csvContent = rows.map(r => 
    r.map(v => (String(v).startsWith('=') ? v : '"' + String(v).replace(/"/g, '""') + '"')).join(',')
  ).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'translations_sample.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
});

// ----- CSV → ARB Converter -----
const dz = document.getElementById('dropzone');
const fileInput = document.getElementById('csvFile');
const statusEl = document.getElementById('status');

function setStatus(msg) { 
  statusEl.textContent = msg || ''; 
}

function parseAndZip(file) {
  setStatus('Parsing…');
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      try {
        const rows = results.data || [];
        const headers = (results.meta && results.meta.fields) || [];
        
        if (!headers.length || headers[0] !== 'key') {
          setStatus('Error: First column must be "key".');
          return;
        }
        
        const languages = headers.slice(1).filter(Boolean);
        if (!languages.length) {
          setStatus('Error: Provide at least one language column.');
          return;
        }

        const zip = new JSZip();

        languages.forEach(lang => {
          const arbData = {};
          rows.forEach(row => {
            const k = row.key;
            let v = row[lang];
            if (k && typeof v === 'string') {
              if (v.trim() === '') return; // skip empty
              arbData[k] = v;
            }
          });
          const content = JSON.stringify(arbData, null, 2);
          zip.file(`app_${lang}.arb`, content);
        });

        zip.generateAsync({ type: 'blob' }).then(content => {
          saveAs(content, 'arb_files.zip');
          setStatus('Done. Download started.');
        });
      } catch (err) {
        console.error(err);
        setStatus('Conversion failed. Check console for details.');
      }
    },
    error: function(err) {
      console.error(err);
      setStatus('Failed to parse CSV.');
    }
  });
}

dz.addEventListener('click', () => fileInput.click());
dz.addEventListener('keydown', (e) => { 
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click(); 
  }
});

// Drag and drop handlers
['dragenter','dragover'].forEach(ev => 
  dz.addEventListener(ev, (e) => { 
    e.preventDefault(); 
    e.stopPropagation(); 
    dz.classList.add('dragover'); 
  })
);

['dragleave','drop'].forEach(ev => 
  dz.addEventListener(ev, (e) => { 
    e.preventDefault(); 
    e.stopPropagation(); 
    dz.classList.remove('dragover'); 
  })
);

dz.addEventListener('drop', (e) => { 
  const file = e.dataTransfer.files && e.dataTransfer.files[0]; 
  if (file) { 
    fileInput.files = e.dataTransfer.files; 
    setStatus(file.name); 
  } 
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) {
    setStatus(file.name);
  }
});

document.getElementById('convertBtn').addEventListener('click', () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) { 
    setStatus('Please choose a CSV file first.'); 
    return; 
  }
  parseAndZip(file);
});