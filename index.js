// ============================================================
// ALP PLANNER - MAIN SCRIPT
// Loaded dynamically by the bookmarklet.
// Requires: config.js (loaded first), SheetJS (loaded below)
// ============================================================

(function () {

  // ── ORIGIN CHECK ───────────────────────────────────────────
  if (!location.hostname.includes('alp.inside.ups.com')) {
    document.open();
    document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ALP Planner</title></head>'
      + '<body style="background:#1a1008;color:#e05c3a;font-family:sans-serif;padding:2rem">'
      + '<h2>This tool must be launched from ALP</h2>'
      + '<p style="color:#e8d9b8">Navigate to alp.inside.ups.com and try again.</p>'
      + '</body></html>');
    document.close();
    return;
  }

  // ── LOAD SHEETJS THEN BUILD UI ─────────────────────────────
  fetch('https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js')
    .then(function(r) { return r.text(); })
    .then(function(code) { eval(code); buildUI(); })
    .catch(function(e) {
      document.body.innerHTML = '<p style="color:#e05c3a;font-family:sans-serif;padding:2rem">Failed to load SheetJS: ' + e.message + '</p>';
    });

  // ── UNKNOWN SLIC MEMORY ────────────────────────────────────
  var unknownSlicAnswers = {};

  // ── STYLES ─────────────────────────────────────────────────
  var inputStyle   = 'background:#1a1008;color:#e8d9b8;border:1px solid #3d2e10;border-radius:3px;padding:.35rem .5rem;font-family:inherit;font-size:13px;';
  var selectStyle  = inputStyle;
  var labelStyle   = 'color:#7a6440;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:.25rem';
  var sectionStyle = 'background:#231608;border:1px solid #3d2e10;border-radius:5px;padding:1rem;margin-bottom:1rem';
  var headingStyle = 'color:#ffb500;font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;margin:0 0 .75rem';

  function fmtDate(d) {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
  }
  function today() { return fmtDate(new Date()); }
  function tomorrow() { var d = new Date(); d.setDate(d.getDate() + 1); return fmtDate(d); }
  function defaultShift() { return new Date().getHours() < CONFIG.shiftCutoffHour ? 'AM' : 'PM'; }

  // ── BUILD UI ───────────────────────────────────────────────
  function buildUI() {
    document.documentElement.style.transition = 'opacity .3s';
    document.documentElement.style.opacity = '0';

    setTimeout(function () {
      document.open();
      document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ALP Planner</title></head>'
        + '<body style="background:#1a1008;color:#e8d9b8;font-family:sans-serif;padding:1.5rem 2rem 4rem;max-width:900px;margin:0 auto;opacity:0;transition:opacity .3s">'
        + '<h2 style="color:#ffb500;margin-bottom:1.5rem">ALP Planner</h2>'
        + '<div id="ui"></div>'
        + '</body></html>');
      document.close();

      document.body.style.opacity = '1';
      renderUI();
    }, 300);
  }

  function renderUI() {
    var ui = document.getElementById('ui');

    // Shift selector
    ui.innerHTML = '<div style="' + sectionStyle + '">'
      + '<p style="' + headingStyle + '">Shift</p>'
      + '<label style="' + labelStyle + '">Shift</label>'
      + '<select id="shift" style="' + selectStyle + 'width:120px">'
      + '<option value="AM"' + (defaultShift() === 'AM' ? ' selected' : '') + '>AM</option>'
      + '<option value="PM"' + (defaultShift() === 'PM' ? ' selected' : '') + '>PM</option>'
      + '</select>'
      + '</div>'

      // Inbounds
      + '<div style="' + sectionStyle + '">'
      + '<p style="' + headingStyle + '">Inbounds</p>'
      + '<div id="rows-in"></div>'
      + '</div>'

      // Outbounds
      + '<div style="' + sectionStyle + '">'
      + '<p style="' + headingStyle + '">Outbounds</p>'
      + '<div id="rows-out"></div>'
      + '</div>'

      // Trailers
      + '<div style="' + sectionStyle + '">'
      + '<p style="' + headingStyle + '">Available Trailers</p>'
      + '<p style="color:#7a6440;font-size:.75rem;margin-bottom:.5rem">Enter trailer numbers. Unknown trailers will be flagged.</p>'
      + '<div id="rows-trailers"></div>'
      + '</div>'

      // Holdover input
      + '<div style="' + sectionStyle + '">'
      + '<p style="' + headingStyle + '">Holdover Volume</p>'
      + '<p style="color:#7a6440;font-size:.75rem;margin-bottom:.5rem">Cans already on site not listed in ALP.</p>'
      + '<div id="rows-holdover"></div>'
      + '</div>'

      // Run button + status
      + '<button id="run-btn" style="background:#ffb500;color:#1a0f00;border:none;border-radius:4px;padding:.65rem 1.5rem;font-weight:bold;cursor:pointer;width:100%">Generate Plans</button>'
      + '<p id="status" style="margin-top:.75rem;font-size:.8rem;min-height:1rem"></p>';

    // Apply prefill from bookmarklet if present
    var prefill = window._ALP_PREFILL || {};
    if (prefill.shift) {
      var sel = document.getElementById('shift');
      sel.value = prefill.shift;
    }
    (prefill.inbounds || []).forEach(function (p) {
      addFlightRow('rows-in', p.flight, p.date === 'today' ? today() : p.date === 'tomorrow' ? tomorrow() : p.date);
    });
    (prefill.outbounds || []).forEach(function (p) {
      addFlightRow('rows-out', p.flight, p.date === 'today' ? today() : p.date === 'tomorrow' ? tomorrow() : p.date);
    });
    addFlightRow('rows-in');
    addFlightRow('rows-out');
    addTrailerRow('rows-trailers');
    addHoldoverRow('rows-holdover');

    document.getElementById('run-btn').onclick = runPlanner;
  }

  // ── DYNAMIC ROW HELPERS ────────────────────────────────────
  function addFlightRow(containerId, flight, date) {
    var row = document.createElement('div');
    row.style = 'display:flex;gap:.5rem;margin-bottom:.4rem;align-items:center';
    var fi = document.createElement('input');
    var di = document.createElement('input');
    fi.placeholder = 'Flight e.g. UPS2993';
    di.placeholder = 'Date e.g. 03-Jun-2026';
    fi.style = inputStyle + 'width:180px';
    di.style = inputStyle + 'width:150px';
    fi.value = flight || '';
    di.value = date || '';
    fi.oninput = di.oninput = function () {
      var rows = document.getElementById(containerId).children;
      if (rows[rows.length - 1].querySelectorAll('input')[0].value.trim()) addFlightRow(containerId);
    };
    row.appendChild(fi);
    row.appendChild(di);
    document.getElementById(containerId).appendChild(row);
  }

  function addTrailerRow(containerId, value) {
    var row = document.createElement('div');
    row.style = 'display:flex;gap:.5rem;margin-bottom:.4rem;align-items:center';
    var ti = document.createElement('input');
    ti.placeholder = 'Trailer number';
    ti.style = inputStyle + 'width:180px';
    ti.value = value || '';
    ti.oninput = function () {
      var rows = document.getElementById(containerId).children;
      if (rows[rows.length - 1].querySelector('input').value.trim()) addTrailerRow(containerId);
    };
    row.appendChild(ti);
    document.getElementById(containerId).appendChild(row);
  }

  function addHoldoverRow(containerId) {
    var row = document.createElement('div');
    row.style = 'display:flex;gap:.5rem;margin-bottom:.4rem;align-items:center';
    var ci = document.createElement('input'); // can number
    var si = document.createElement('input'); // slic
    var pi = document.createElement('input'); // pieces
    ci.placeholder = 'Can #';       ci.style = inputStyle + 'width:120px';
    si.placeholder = 'SLIC';        si.style = inputStyle + 'width:120px';
    pi.placeholder = 'Pcs';         pi.style = inputStyle + 'width:80px';
    ci.oninput = si.oninput = pi.oninput = function () {
      var rows = document.getElementById(containerId).children;
      var last = rows[rows.length - 1];
      if (last.querySelectorAll('input')[0].value.trim()) addHoldoverRow(containerId);
    };
    row.appendChild(ci); row.appendChild(si); row.appendChild(pi);
    document.getElementById(containerId).appendChild(row);
  }

  // ── DATA COLLECTION HELPERS ────────────────────────────────
  function getFlights(containerId) {
    return Array.from(document.getElementById(containerId).querySelectorAll('div')).map(function (r) {
      var inputs = r.querySelectorAll('input');
      return { flight: inputs[0].value.trim(), date: inputs[1].value.trim() || today() };
    }).filter(function (f) { return f.flight; });
  }

  function getTrailers() {
    return Array.from(document.getElementById('rows-trailers').querySelectorAll('input'))
      .map(function (i) { return i.value.trim(); }).filter(Boolean);
  }

  function getHoldover() {
    return Array.from(document.getElementById('rows-holdover').querySelectorAll('div')).map(function (r) {
      var inputs = r.querySelectorAll('input');
      return { can: inputs[0].value.trim(), slic: inputs[1].value.trim(), pcs: parseInt(inputs[2].value) || 0 };
    }).filter(function (h) { return h.can && h.slic; });
  }

  function setStatus(msg, color) {
    var s = document.getElementById('status');
    s.style.color = color || '#e8d9b8';
    s.textContent = msg;
  }

  // ── FETCH ALP DATA ─────────────────────────────────────────
  async function fetchFlight(flight, date) {
    var url = CONFIG.alpBase
      + '?movement=' + flight.toLowerCase()
      + '&originGateway=' + CONFIG.gateway
      + '&movementDate=' + date
      + '&sortBy=LoadOrder';
    var resp = await fetch(url, { credentials: 'include' });
    if (!resp.ok) throw new Error(flight + ': HTTP ' + resp.status);
    var doc = new DOMParser().parseFromString(await resp.text(), 'text/html');

    // Get can data from main table
    var table = doc.getElementById(CONFIG.alpTableId);
    if (!table) throw new Error(flight + ': table#' + CONFIG.alpTableId + ' not found');

    var headers = Array.from(table.querySelectorAll('thead th')).map(function (c) { return c.innerText.trim(); });
    var rows = Array.from(table.querySelectorAll('tbody tr')).map(function (tr) {
      var obj = {};
      Array.from(tr.querySelectorAll('td')).forEach(function (td, i) { obj[headers[i]] = td.innerText.trim(); });
      return obj;
    });

    // Get aircraft type from page (looks for text like "76p", "75", "A3")
    var aircraftType = detectAircraftType(doc);

    // Get tail number (links inbound to outbound)
    var tailNumber = detectTailNumber(doc);

    // Get origin/destination from page header
    var origin = detectOrigin(doc);
    var destination = detectDestination(doc);

    return { flight: flight, date: date, rows: rows, aircraftType: aircraftType, tailNumber: tailNumber, origin: origin, destination: destination };
  }

  function detectAircraftType(doc) {
    // Look for aircraft type string on the page
    var text = doc.body ? doc.body.innerText : '';
    if (/A3/i.test(text))  return 'A3';
    if (/76p?/i.test(text)) return '76';
    if (/75/i.test(text))  return '75';
    return null; // will need to handle unknown
  }

  function detectTailNumber(doc) {
    // Tail numbers typically start with N, e.g. N144UP
    var match = (doc.body ? doc.body.innerText : '').match(/\bN\d+UP\b/);
    return match ? match[0] : null;
  }

  function detectOrigin(doc) {
    // STUB: parse from page header
    return null;
  }

  function detectDestination(doc) {
    // STUB: parse from page header - 3 letter gateway code
    return null;
  }

  // ── PROMPT FOR UNKNOWN SLICS ───────────────────────────────
  async function resolveUnknownSlics(allCans, shift) {
    var known = CONFIG.destinationRouting[shift];
    var unknown = [];
    allCans.forEach(function (can) {
      var dest = can.Destination;
      if (!dest || dest === 'VOID' || dest === 'MT') return;
      if (CONFIG.dispoRouting[can.Dispo]) return;
      if (known[dest]) return;
      if (unknownSlicAnswers[dest]) return;
      if (unknown.indexOf(dest) === -1) unknown.push(dest);
    });

    for (var i = 0; i < unknown.length; i++) {
      var dest = unknown[i];
      var answer = await promptForSlic(dest, shift);
      unknownSlicAnswers[dest] = answer;
    }
  }

  function promptForSlic(dest, shift) {
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center';

      var sections = ['USPS', 'MDU', 'SFAC', 'HOLDOVER', 'TRAILER'];
      var options = sections.map(function (s) {
        return '<option value="' + s + '">' + s + '</option>';
      }).join('');

      var trailerOptions = ['9929N','9929D','9929P','8385P','9930P'].map(function (t) {
        return '<option value="TRAILER:' + t + '">TRAILER → ' + t + '</option>';
      }).join('');

      overlay.innerHTML = '<div style="background:#231608;border:1px solid #3d2e10;border-radius:6px;padding:1.5rem;min-width:320px">'
        + '<p style="color:#ffb500;margin-bottom:1rem;font-weight:bold">Unknown destination: ' + dest + '</p>'
        + '<p style="color:#e8d9b8;font-size:.85rem;margin-bottom:.75rem">Where should cans going to <b>' + dest + '</b> be planned? (' + shift + ' shift)</p>'
        + '<select id="slic-answer" style="' + selectStyle + 'width:100%;margin-bottom:1rem">'
        + options + trailerOptions
        + '</select>'
        + '<button style="background:#ffb500;color:#1a0f00;border:none;border-radius:4px;padding:.5rem 1rem;font-weight:bold;cursor:pointer;width:100%">Confirm</button>'
        + '</div>';

      overlay.querySelector('button').onclick = function () {
        var val = document.getElementById('slic-answer').value;
        document.body.removeChild(overlay);
        if (val.startsWith('TRAILER:')) {
          resolve({ section: 'TRAILER', trailerDest: val.split(':')[1] });
        } else {
          resolve({ section: val });
        }
      };

      document.body.appendChild(overlay);
    });
  }

  // ── TRAILER RESOLUTION ─────────────────────────────────────
  function resolveTrailerTypes(trailerNumbers) {
    var resolved = [];
    var unknownNumbers = [];

    trailerNumbers.forEach(function (num) {
      if (CONFIG.trailerTypes[num]) {
        resolved.push({ number: num, type: CONFIG.trailerTypes[num] });
      } else {
        unknownNumbers.push(num);
      }
    });

    return { resolved: resolved, unknown: unknownNumbers };
  }

  function promptForUnknownTrailers(unknownNumbers) {
    return new Promise(function (resolve) {
      if (!unknownNumbers.length) { resolve([]); return; }

      var overlay = document.createElement('div');
      overlay.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center';

      var rows = unknownNumbers.map(function (num) {
        return '<div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.4rem">'
          + '<span style="color:#e8d9b8;width:100px;font-family:monospace">' + num + '</span>'
          + '<select data-trailer="' + num + '" style="' + selectStyle + '">'
          + '<option value="A4">A4 (4 slots)</option>'
          + '<option value="A5">A5 (5 slots)</option>'
          + '</select></div>';
      }).join('');

      overlay.innerHTML = '<div style="background:#231608;border:1px solid #3d2e10;border-radius:6px;padding:1.5rem;min-width:320px">'
        + '<p style="color:#ffb500;margin-bottom:1rem;font-weight:bold">Unknown Trailers</p>'
        + '<p style="color:#e8d9b8;font-size:.85rem;margin-bottom:.75rem">Select type for each unknown trailer:</p>'
        + rows
        + '<button style="background:#ffb500;color:#1a0f00;border:none;border-radius:4px;padding:.5rem 1rem;font-weight:bold;cursor:pointer;width:100%;margin-top:.75rem">Confirm</button>'
        + '</div>';

      overlay.querySelector('button').onclick = function () {
        var results = Array.from(overlay.querySelectorAll('select[data-trailer]')).map(function (sel) {
          return { number: sel.getAttribute('data-trailer'), type: sel.value };
        });
        document.body.removeChild(overlay);
        resolve(results);
      };
