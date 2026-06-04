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
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js';
  script.onload = buildUI;
  document.head.appendChild(script);

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

      document.body.appendChild(overlay);
    });
  }

  // ── ROUTING LOGIC ──────────────────────────────────────────
  function routeCan(can, shift) {
    var dest = can.Destination;
    var dispo = can.Dispo;

    // VOID/MT skip
    if (dest === 'VOID' || dest === 'MT') return null;

    // Dispo override
    if (CONFIG.dispoRouting[dispo]) return { section: CONFIG.dispoRouting[dispo] };

    // Through freight
    var originPrefix = can.Origin ? can.Origin.substring(0, 4) : '';
    if (CONFIG.throughFreightOrigins[originPrefix]) {
      return { section: 'THROUGH', gateway: CONFIG.throughFreightOrigins[originPrefix] };
    }

    // Destination routing
    var routing = (CONFIG.destinationRouting[shift] || {})[dest];
    if (routing) return routing;

    // Unknown - use remembered answer
    if (unknownSlicAnswers[dest]) return unknownSlicAnswers[dest];

    return { section: 'UNKNOWN', dest: dest };
  }

  function assignTrailers(cansByDest, availableTrailers, shift) {
    // Returns array of trailer objects: { number, type, dest, slots: [{can, dest, pcs, fromPlan}] }
    var trailers = [];
    var slotCounts = { A4: 4, A5: 5 };

    // Helper: get or create trailer for a destination
    function getTrailer(trailerDest, forceNew) {
      if (!forceNew) {
        var existing = trailers.filter(function (t) { return t.dest === trailerDest && !t.full; });
        if (existing.length) return existing[existing.length - 1];
      }
      var avail = availableTrailers.shift();
      if (!avail) return null; // no trailers left
      var t = { number: avail.number, type: avail.type, dest: trailerDest, slots: [], full: false };
      trailers.push(t);
      return t;
    }

    function addToTrailer(trailer, can) {
      trailer.slots.push(can);
      var cap = slotCounts[trailer.type] || 4;
      if (trailer.slots.length >= cap) trailer.full = true;
    }

    // Process each destination group
    Object.keys(cansByDest).forEach(function (trailerDest) {
      var cans = cansByDest[trailerDest];
      var routing = null;

      // Find routing rule
      Object.keys(CONFIG.destinationRouting[shift] || {}).forEach(function (key) {
        var r = CONFIG.destinationRouting[shift][key];
        if (r.trailerDest === trailerDest) routing = r;
      });

      // Handle 9930P sfac overflow
      if (routing && routing.sfacOverflow && cans.length > 1) {
        cans = cans.slice(0, cans.length - CONFIG.sfacOverflowCount);
      }

      // minForTrailer: send to holdover if below threshold
      if (routing && routing.minForTrailer && cans.length < routing.minForTrailer) {
        cans.forEach(function (c) { c._section = 'HOLDOVER'; });
        return;
      }

      // alwaysOwn: always get a dedicated trailer
      var forceNew = routing && routing.alwaysOwn;

      var trailer = getTrailer(trailerDest, forceNew);
      if (!trailer) return;

      cans.forEach(function (can) {
        if (!trailer || trailer.full) trailer = getTrailer(trailerDest, false);
        if (!trailer) { can._section = 'HOLDOVER'; return; }
        addToTrailer(trailer, can);
      });

      // Pad with MT
      if (trailer) {
        var cap = slotCounts[trailer.type] || 4;
        while (trailer.slots.length < cap) trailer.slots.push({ can: 'MT', dest: 'MT', pcs: '' });
      }
    });

    return trailers;
  }

  // ── XLSX GENERATION ────────────────────────────────────────
  function makeUSPSReport(uspsCans, date) {
    var wb = XLSX.utils.book_new();
    var rows = [];

    rows.push(['UPS / USPS ULD Transfer / Delivery']);
    rows.push([]);
    rows.push(['GTW:', CONFIG.gateway, '', '', '', 'Version 6.06.24', '', '', '', '', '', '', 'Date:', date]);
    rows.push([]);
    rows.push(['', 'ULD Type / Number', '', '', '', 'Destination', '', 'Weight', '', '', 'Flight Number', '', '', 'Sched Arr.', '', 'Actual Arr.']);
    rows.push([]);
    rows.push(['Example:', 'AAY 82433 UPS', '', '', '', 'RFD', '', '2990', '', '', 'UPS0611', '', '', '4:40 AM', '', '4:22 AM']);
    rows.push([]);

    uspsCans.forEach(function (can, i) {
      var uldNum = (can.Type || '') + (can.Can || '') + 'UPS';
      rows.push([i + 1, '', uldNum, '', '', can.Destination, '', can.Weight, '', '', can.Flight, '', '', '', '', '']);
      rows.push([]);
    });

    // Pad to 25
    var filled = uspsCans.length;
    for (var i = filled + 1; i <= 25; i++) {
      rows.push([i]);
      rows.push([]);
    }

    var ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'USPS Report');
    return wb;
  }

  function makeLoadPlan(inbounds, outbounds, trailers, holdover, mduCans, uspsCans, sfacCans, shift, date) {
    var wb = XLSX.utils.book_new();
    var rows = [];

    // Header row - flight numbers
    var headerRow = [];
    inbounds.forEach(function (ib) { headerRow.push(ib.flight); for (var i = 0; i < 12; i++) headerRow.push(''); });
    outbounds.forEach(function (ob) { headerRow.push(ob.flight); for (var i = 0; i < 12; i++) headerRow.push(''); });
    rows.push(headerRow);

    // Origin → destination row
    // STUB: populate from ALP detection when available
    rows.push([]);

    // Tail / ETA row
    // STUB: populate from ALP detection when available
    rows.push([]);
    rows.push([]);

    // Position rows - one per aircraft position
    var maxPositions = 0;
    inbounds.forEach(function (ib) {
      var layout = CONFIG.aircraft[ib.aircraftType];
      if (!layout) return;
      var positions = (layout.topDeck || []).concat(layout.lowerDeck || layout.mainDeck || []);
      if (positions.length > maxPositions) maxPositions = positions.length;
    });

    for (var p = 0; p < maxPositions; p++) {
      var row = [];
      inbounds.forEach(function (ib) {
        var layout = CONFIG.aircraft[ib.aircraftType];
        if (!layout) { row.push('', '', '', ''); return; }
        var positions = (layout.topDeck || []).concat(layout.lowerDeck || layout.mainDeck || []);
        var pos = positions[p];
        if (!pos) { row.push('', '', '', ''); return; }
        var can = ib.rows.find(function (r) { return r.POS === pos; });
        if (can) {
          row.push(pos, can.Can || '', can.Destination || '', can.Pkgs || '');
        } else {
          row.push(pos, '', 'VOID', '');
        }
      });
      outbounds.forEach(function (ob) {
        var layout = CONFIG.aircraft[ob.aircraftType];
        if (!layout) { row.push('', '', '', ''); return; }
        var positions = (layout.topDeck || []).concat(layout.lowerDeck || layout.mainDeck || []);
        var pos = positions[p];
        if (!pos) { row.push('', '', '', ''); return; }
        var can = ob.rows.find(function (r) { return r.POS === pos; });
        if (can) {
          row.push(pos, can.Can || '', can.Destination || '', can.Pkgs || '');
        } else {
          row.push(pos, '', 'MT', '');
        }
      });
      rows.push(row);
    }

    rows.push([]);

    // Trailer section
    rows.push(['Outbound Trailers']);
    var trailersPerRow = CONFIG.trailersPerRow || 3;
    for (var t = 0; t < trailers.length; t += trailersPerRow) {
      var group = trailers.slice(t, t + trailersPerRow);
      var headerCols = [];
      group.forEach(function (tr) {
        headerCols.push(tr.dest, '', tr.type, '', tr.number, '');
      });
      rows.push(headerCols);
      rows.push(['', 'Cont#', 'Dest.', 'Pcs', '', 'Cont#', 'Dest.', 'Pcs', '', 'Cont#', 'Dest.', 'Pcs']);
      var maxSlots = Math.max.apply(null, group.map(function (tr) { return tr.slots.length; }));
      for (var s = 0; s < maxSlots; s++) {
        var slotRow = [];
        group.forEach(function (tr) {
          var slot = tr.slots[s];
          if (slot) {
            slotRow.push(s + 1, slot.can || '', slot.dest || '', slot.pcs || '');
          } else {
            slotRow.push(s + 1, '', '', '');
          }
        });
        rows.push(slotRow);
      }
      rows.push([]);
    }

    // MDU or USPS section
    if (shift === 'AM' && mduCans.length) {
      rows.push(['MDU']);
      rows.push(['', 'Cont#', 'Dest.', 'Pcs']);
      mduCans.forEach(function (c, i) {
        rows.push([i + 1, c.Can || '', c.Destination || '', c.Pkgs || '']);
      });
      rows.push([]);
    }
    if (shift === 'PM' && uspsCans.length) {
      rows.push(['USPS']);
      rows.push(['', 'Cont#', 'Dest.', 'Pcs']);
      uspsCans.forEach(function (c, i) {
        rows.push([i + 1, c.Can || '', c.Destination || '', c.Pkgs || '']);
      });
      rows.push([]);
    }

    // SFAC section
    if (sfacCans.length) {
      rows.push(['SFAC']);
      rows.push(['', 'Cont#', 'Dest.', 'Pcs']);
      sfacCans.forEach(function (c, i) {
        rows.push([i + 1, c.Can || '', c.Destination || '', c.Pkgs || '']);
      });
      rows.push([]);
    }

    // Holdover/Throat section
    if (holdover.length) {
      rows.push(['Holdover']);
      rows.push(['', 'Cont#', 'Dest.', 'Pcs']);
      holdover.forEach(function (c, i) {
        rows.push([i + 1, c.can || c.Can || '', c.slic || c.Destination || '', c.pcs || c.Pkgs || '']);
      });
    }

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 8 }, { wch: 8 }, { wch: 5 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Load Plan');
    return wb;
  }

  function makeTrailerSheet(trailers, date) {
    var wb = XLSX.utils.book_new();
    var rows = [];
    rows.push(['Trailer Sheet', '', date]);
    rows.push([]);

    var trailersPerRow = CONFIG.trailersPerRow || 3;
    for (var t = 0; t < trailers.length; t += trailersPerRow) {
      var group = trailers.slice(t, t + trailersPerRow);
      var headerCols = [];
      group.forEach(function (tr) {
        headerCols.push(tr.dest, '', tr.type, '', tr.number, '');
      });
      rows.push(headerCols);
      rows.push(['', 'Cont#', 'Dest.', 'Pcs', '', 'Cont#', 'Dest.', 'Pcs', '', 'Cont#', 'Dest.', 'Pcs']);
      var maxSlots = Math.max.apply(null, group.map(function (tr) { return tr.slots.length; }));
      for (var s = 0; s < maxSlots; s++) {
        var slotRow = [];
        group.forEach(function (tr) {
          var slot = tr.slots[s];
          if (slot) {
            slotRow.push(s + 1, slot.can || '', slot.dest || '', slot.pcs || '');
          } else {
            slotRow.push(s + 1, '', '', '');
          }
        });
        rows.push(slotRow);
      }
      rows.push([]);
    }

    var ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Trailer Sheet');
    return wb;
  }

  // Build a map of can# → vendor label, used by makeVendorPlan
  // Must be called after trailers are assigned so T1/T2 labels are known
  function buildVendorLabelMap(assignedTrailers, uspsCans, mduCans, sfacCans, holdoverCans, throughCans) {
    var map = {};
    assignedTrailers.forEach(function (tr, i) {
      var label = 'T' + (i + 1);
      tr.slots.forEach(function (slot) {
        if (slot.can && slot.can !== 'MT') map[slot.can] = label;
      });
    });
    uspsCans.forEach(function (c)     { map[c.Can] = CONFIG.vendorSectionLabels['USPS']     || 'USPS'; });
    mduCans.forEach(function (c)      { map[c.Can] = CONFIG.vendorSectionLabels['MDU']      || 'MDU'; });
    sfacCans.forEach(function (c)     { map[c.Can] = CONFIG.vendorSectionLabels['SFAC']     || 'SFAC'; });
    holdoverCans.forEach(function (c) { map[c.Can || c.can] = CONFIG.vendorSectionLabels['HOLDOVER'] || 'WB'; });
    throughCans.forEach(function (c)  { map[c.Can] = CONFIG.vendorSectionLabels['THROUGH']  || 'JET'; });
    return map;
  }

  function makeVendorPlan(inbounds, outbounds, vendorLabelMap, shift, date) {
    var wb = XLSX.utils.book_new();
    var rows = [];

    var headerRow = [];
    inbounds.forEach(function (ib) { headerRow.push(ib.flight); for (var i = 0; i < 12; i++) headerRow.push(''); });
    outbounds.forEach(function (ob) { headerRow.push(ob.flight); for (var i = 0; i < 12; i++) headerRow.push(''); });
    rows.push(headerRow);
    rows.push([]);
    rows.push([]);
    rows.push([]);

    var maxPositions = 0;
    inbounds.forEach(function (ib) {
      var layout = CONFIG.aircraft[ib.aircraftType];
      if (!layout) return;
      var positions = (layout.topDeck || []).concat(layout.lowerDeck || layout.mainDeck || []);
      if (positions.length > maxPositions) maxPositions = positions.length;
    });

    for (var p = 0; p < maxPositions; p++) {
      var row = [];
      inbounds.forEach(function (ib) {
        var layout = CONFIG.aircraft[ib.aircraftType];
        if (!layout) { row.push('', '', '', ''); return; }
        var positions = (layout.topDeck || []).concat(layout.lowerDeck || layout.mainDeck || []);
        var pos = positions[p];
        if (!pos) { row.push('', '', '', ''); return; }
        var can = ib.rows.find(function (r) { return r.POS === pos; });
        if (can) {
          // Replace Pkgs with vendor label
          row.push(pos, can.Can || '', can.Destination || '', vendorLabelMap[can.Can] || '');
        } else {
          row.push(pos, '', 'VOID', '');
        }
      });
      outbounds.forEach(function (ob) {
        var layout = CONFIG.aircraft[ob.aircraftType];
        if (!layout) { row.push('', '', '', ''); return; }
        var positions = (layout.topDeck || []).concat(layout.lowerDeck || layout.mainDeck || []);
        var pos = positions[p];
        if (!pos) { row.push('', '', '', ''); return; }
        var can = ob.rows.find(function (r) { return r.POS === pos; });
        if (can) {
          row.push(pos, can.Can || '', can.Destination || '', vendorLabelMap[can.Can] || '');
        } else {
          row.push(pos, '', 'MT', '');
        }
      });
      rows.push(row);
    }

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 8 }, { wch: 8 }, { wch: 5 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Vendor Plan');
    return wb;
  }

  function downloadWorkbook(wb, filename) {
    XLSX.writeFile(wb, filename);
  }

  // ── MAIN PLANNER LOGIC ─────────────────────────────────────
  async function runPlanner() {
    var btn = document.getElementById('run-btn');
    btn.disabled = true;

    var shift = document.getElementById('shift').value;
    var inFlights = getFlights('rows-in');
    var outFlights = getFlights('rows-out');
    var trailerNumbers = getTrailers();
    var holdoverInput = getHoldover();
    var dateStr = inFlights.length ? inFlights[0].date : today();

    if (!inFlights.length) {
      setStatus('✕ Enter at least one inbound flight.', '#e05c3a');
      btn.disabled = false;
      return;
    }

    try {
      // Resolve trailer types
      var trailerResolution = resolveTrailerTypes(trailerNumbers);
      var unknownTrailers = await promptForUnknownTrailers(trailerResolution.unknown);
      var allTrailers = trailerResolution.resolved.concat(unknownTrailers);

      // Fetch all flights
      setStatus('Fetching inbounds…');
      var inboundData = await Promise.all(inFlights.map(function (f) { return fetchFlight(f.flight, f.date); }));

      setStatus('Fetching outbounds…');
      var outboundData = outFlights.length
        ? await Promise.all(outFlights.map(function (f) { return fetchFlight(f.flight, f.date); }))
        : [];

      // Collect all cans
      var allCans = [];
      inboundData.forEach(function (ib) {
        ib.rows.forEach(function (row) { row._flight = ib.flight; row._date = ib.date; allCans.push(row); });
      });

      // Resolve unknown SLICs
      setStatus('Checking destinations…');
      await resolveUnknownSlics(allCans, shift);

      // Route all cans
      var uspsCans = [], mduCans = [], sfacCans = [], holdoverCans = [], throughCans = [], cansByTrailerDest = {};
      holdoverCans = holdoverCans.concat(holdoverInput);

      allCans.forEach(function (can) {
        var route = routeCan(can, shift);
        if (!route) return;
        can._route = route;
        if (route.section === 'USPS')     { uspsCans.push(can); can.Flight = can._flight; }
        else if (route.section === 'MDU') { mduCans.push(can); }
        else if (route.section === 'SFAC') { sfacCans.push(can); }
        else if (route.section === 'HOLDOVER') { holdoverCans.push(can); }
        else if (route.section === 'THROUGH') { throughCans.push(can); }
        else if (route.section === 'TRAILER') {
          var td = route.trailerDest;
          if (!cansByTrailerDest[td]) cansByTrailerDest[td] = [];
          cansByTrailerDest[td].push(can);
        }
      });

      // Handle 9930P SFAC overflow
      if (cansByTrailerDest['9930P'] && cansByTrailerDest['9930P'].length > 1) {
        var overflowCount = CONFIG.sfacOverflowCount;
        var overflowCans = cansByTrailerDest['9930P'].splice(cansByTrailerDest['9930P'].length - overflowCount, overflowCount);
        sfacCans = sfacCans.concat(overflowCans);
      }

      // Assign trailers
      var assignedTrailers = assignTrailers(cansByTrailerDest, allTrailers.slice(), shift);

      // Build vendor label map (requires finalized trailer assignments)
      var vendorLabelMap = buildVendorLabelMap(assignedTrailers, uspsCans, mduCans, sfacCans, holdoverCans, throughCans);

      // Determine if single or double turn
      var isSingleTurn = inboundData.length === 1;
      var plans = isSingleTurn
        ? [{ inbounds: inboundData, outbounds: outboundData }]
        : [
            { inbounds: inboundData.slice(0, 2), outbounds: outboundData.slice(0, 2) },
          ];

      // If 3 inbounds, split into early single + main double
      if (inboundData.length === 3) {
        plans = [
          { inbounds: [inboundData[0]], outbounds: outboundData.length ? [outboundData[0]] : [], label: 'early' },
          { inbounds: inboundData.slice(1), outbounds: outboundData.slice(1), label: 'main' },
        ];
      }

      // Generate files
      setStatus('Generating files…');

      plans.forEach(function (plan, idx) {
        var suffix = plans.length > 1 ? (plan.label || ('plan' + (idx + 1))) + '_' : '';
        var wb = makeLoadPlan(plan.inbounds, plan.outbounds, assignedTrailers, holdoverCans, mduCans, uspsCans, sfacCans, shift, dateStr);
        downloadWorkbook(wb, 'load_plan_' + suffix + dateStr + '.xlsx');
        var vb = makeVendorPlan(plan.inbounds, plan.outbounds, vendorLabelMap, shift, dateStr);
        downloadWorkbook(vb, 'vendor_plan_' + suffix + dateStr + '.xlsx');
      });

      downloadWorkbook(makeUSPSReport(uspsCans, dateStr), 'usps_report_' + dateStr + '.xlsx');
      downloadWorkbook(makeTrailerSheet(assignedTrailers, dateStr), 'trailer_sheet_' + dateStr + '.xlsx');

      setStatus('\u2713 Done \u2014 ' + plans.length + ' load plan(s) + vendor plan(s), USPS report, trailer sheet generated.', '#8cb87a');

    } catch (err) {
      setStatus('✕ ' + err.message, '#e05c3a');
      console.error(err);
    }

    btn.disabled = false;
  }

})();
