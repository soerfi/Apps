// --- Global State & Config ---
let scansChart = null;

const THEME = {
  brand: '#10b981',
  brandSoft: 'rgba(16, 185, 129, 0.1)',
  muted: '#94a3b8',
  line: 'rgba(255, 255, 255, 0.08)',
};

window.librarySorting = { field: 'created_at', direction: 'desc' };

// --- Core API Wrapper ---
async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    const message = body && body.error ? body.error : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
}

// --- UI Components ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

const copyToClipboard = (text) => {
  if (!text) return;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Link copied to clipboard');
    }).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
};

function fallbackCopy(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";  // Avoid scrolling to bottom
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast('Link copied to clipboard');
  } catch (err) {
    showToast('Failed to copy', 'error');
  }
  document.body.removeChild(textArea);
}

function metricCard(label, value) {
  return `
    <div class="metric">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

window.filterByCampaign = (val) => {
  const sel = document.getElementById("filter-campaign");
  sel.value = val;
  // Trigger change manually or just load
  loadAnalytics();
  document.querySelector(".analytics-section").scrollIntoView({ behavior: "smooth" });
};

window.editQR = async (id) => {
  try {
    const data = await api(`api/qrcodes/${id}`); // Actually we assume we can GET by ID or just use finding from list? 
    // Wait, typical pattern is GET /api/qrcodes/:id. Let's assume it exists or use list data.
    // Standard list item might not have all fields if truncated. Better to fetch fresh.
    // The list_qr_codes endpoint returns items. There isn't a single GET endpoint in app.py?
    // Let's check app.py. There is NO GET /api/qrcodes/:id. Only PATCH.
    // I need to add GET /api/qrcodes/:id to app.py? 
    // Or I use the data already in the DOM? The DOM only has a subset.
    // I MUST ADD GET /api/qrcodes/:id to app.py OR rely on the table data if it had everything (which it doesn't).
    // Let's implement fetching from the list for now if I can find it, otherwise I need to patch backend.

    // Quick Fix: I will rely on the `qr_to_dict` logic. The list endpoint returns mostly everything.
    // Let's iterate the `library-body` rows and find the data? No, that's brittle.
    // Providing a GET endpoint is best practice. 
    // However, for speed, I can just filter the current list if I store it. 
    // Let's store the list in a variable `libraryData`.
    const item = window.libraryData.find(i => i.id == id);
    if (!item) throw new Error("Item not found");

    const modal = document.getElementById("edit-modal");
    const form = document.getElementById("edit-form");

    form.id.value = item.id;
    form.destination_url.value = item.destination_url;
    form.name.value = item.name || "";
    form.campaign.value = item.campaign || "";
    form.channel.value = item.channel || "";
    form.location.value = item.location || "";
    if (form.owner) form.owner.value = item.owner || "";

    form.utm_source.value = item.utm_source || "";
    form.utm_medium.value = item.utm_medium || "";
    form.utm_campaign.value = item.utm_campaign || "";
    form.utm_term.value = item.utm_term || "";
    form.utm_content.value = item.utm_content || "";
    form.auto_append_utm.checked = item.auto_append_utm;

    // Date only for expires_at input[type=date]
    if (item.expires_at) {
      form.expires_at.value = item.expires_at.split('T')[0];
    } else {
      form.expires_at.value = "";
    }

    modal.classList.add("active");
    window.hideDeleteConfirm();
  } catch (e) {
    showToast("Error loading details: " + e.message, "error");
  }
};

window.closeEditModal = () => {
  document.getElementById("edit-modal").classList.remove("active");
};

window.showDeleteConfirm = () => {
  document.getElementById("delete-confirm-box").style.display = "flex";
  lucide.createIcons();
};

window.hideDeleteConfirm = () => {
  document.getElementById("delete-confirm-box").style.display = "none";
};

window.deleteQR = async (id) => {
  try {
    await api(`api/qrcodes/${id}`, { method: "DELETE" });
    showToast("QR Code deleted");
    window.hideDeleteConfirm();
    window.closeEditModal();
    loadLibrary();
    loadAnalytics();
  } catch (err) {
    showToast(err.message, "error");
  }
};

window.bulkEdit = (manualIds = null) => {
  const selected = manualIds || getSelectedIds();
  if (!selected.length) return;
  document.getElementById("bulk-modal-count").textContent = `(${selected.length} items)`;
  document.getElementById("bulk-modal").classList.add("active");
};

window.closeBulkModal = () => {
  document.getElementById("bulk-modal").classList.remove("active");
};

window.bulkDelete = async () => {
  const selected = getSelectedIds();
  if (!selected.length) return;
  if (!confirm(`Delete ${selected.length} QR codes and all their data?`)) return;

  try {
    await api("api/qrcodes/bulk_action", {
      method: "POST",
      body: JSON.stringify({ action: "delete", ids: selected })
    });
    showToast(`Deleted ${selected.length} codes`);
    loadLibrary();
    loadAnalytics();
    clearSelection();
  } catch (err) {
    showToast(err.message, "error");
  }
};

window.bulkDownload = async (format = "png") => {
  const selected = getSelectedIds();
  if (!selected.length) return;

  const fmt = format.toLowerCase();
  const size = parseInt(document.getElementById('global-export-size').value) || 400;

  try {
    showToast(`Preparing ZIP for ${selected.length} codes...`);
    const res = await fetch("api/qrcodes/bulk_action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "download_zip",
        ids: selected,
        format: fmt,
        size: size
      })
    });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `QR_Library_${fmt}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    clearSelection();
  } catch (err) {
    showToast(err.message, "error");
  }
};

function getSelectedIds() {
  const checks = document.querySelectorAll(".qr-check:checked");
  return Array.from(checks).map(c => parseInt(c.dataset.id));
}

function updateBulkToolbar() {
  const selected = getSelectedIds();
  const toolbar = document.getElementById("bulk-toolbar");
  const countLabel = document.getElementById("bulk-count");
  if (selected.length > 0) {
    toolbar.style.display = "flex";
    countLabel.textContent = `${selected.length} selected`;
  } else {
    toolbar.style.display = "none";
  }
}

function clearSelection() {
  document.querySelectorAll(".qr-check").forEach(c => c.checked = false);
  const selectAll = document.getElementById("select-all");
  if (selectAll) selectAll.checked = false;
  updateBulkToolbar();
}

window.sortLibrary = (field) => {
  if (window.librarySorting.field === field) {
    window.librarySorting.direction = window.librarySorting.direction === 'asc' ? 'desc' : 'asc';
  } else {
    window.librarySorting.field = field;
    window.librarySorting.direction = 'desc';
  }

  if (window.libraryData) {
    window.libraryData.sort((a, b) => {
      let vA = a[field];
      let vB = b[field];

      if (field === 'created_at' || field === 'expires_at' || field === 'updated_at') {
        vA = vA ? new Date(vA).getTime() : 0;
        vB = vB ? new Date(vB).getTime() : 0;
      } else {
        if (vA == null) vA = '';
        if (vB == null) vB = '';
        if (typeof vA === 'string') vA = vA.toLowerCase();
        if (typeof vB === 'string') vB = vB.toLowerCase();
      }

      if (vA < vB) return window.librarySorting.direction === 'asc' ? -1 : 1;
      if (vA > vB) return window.librarySorting.direction === 'asc' ? 1 : -1;
      return 0;
    });
    renderLibrary();
  }
};

// --- Charting ---
function updateChart(rows) {
  const ctx = document.getElementById('scansChart').getContext('2d');

  if (scansChart) {
    scansChart.destroy();
  }

  if (!rows.length) return;

  scansChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: rows.map(r => r.bucket),
      datasets: [{
        label: 'Total Scans',
        data: rows.map(r => r.total_scans),
        borderColor: THEME.brand,
        backgroundColor: THEME.brandSoft,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: '#1e293b',
          titleColor: '#f8fafc',
          bodyColor: '#f8fafc',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: THEME.muted, font: { size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: THEME.line },
          ticks: { color: THEME.muted, font: { size: 11 } }
        }
      }
    }
  });
}

// --- Options Loading ---
async function loadAnalyticsOptions() {
  try {
    const data = await api("api/analytics/options");
    const camps = document.getElementById("filter-campaign");
    const chans = document.getElementById("filter-channel");

    // Preserve current selection if reloading
    const currCamp = camps.value;
    const currChan = chans.value;

    camps.innerHTML = '<option value="">All Campaigns</option>' +
      data.campaigns.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

    chans.innerHTML = '<option value="">All Channels</option>' +
      data.channels.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

    if (currCamp) camps.value = currCamp;
    if (currChan) chans.value = currChan;
  } catch (e) {
    console.error("Failed to load options", e);
  }
}

// --- Library Management ---
async function loadLibrary() {
  const form = document.getElementById("library-filter");
  const params = new URLSearchParams(new FormData(form));
  params.set("per_page", "50");

  const data = await api(`api/qrcodes?${params.toString()}`);
  window.libraryData = data.items;

  // Apply current sorting if any
  if (window.librarySorting.field !== 'created_at' || window.librarySorting.direction !== 'desc') {
    const field = window.librarySorting.field;
    const dir = window.librarySorting.direction;
    window.libraryData.sort((a, b) => {
      let vA = a[field] || '';
      let vB = b[field] || '';
      if (typeof vA === 'string') vA = vA.toLowerCase();
      if (typeof vB === 'string') vB = vB.toLowerCase();
      if (vA < vB) return dir === 'asc' ? -1 : 1;
      if (vA > vB) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  renderLibrary();

  // Load Library Stats
  const stats = await api("api/library/stats");
  document.getElementById("library-stats").innerHTML = `
    <span class="pill active">Active: ${stats.active}</span>
    <span class="pill">Total: ${stats.total}</span>
  `;
}

function renderLibrary() {
  const body = document.getElementById("library-body");
  if (!window.libraryData || !window.libraryData.length) {
    body.innerHTML = "<tr><td colspan='7' class='hint center'>No QR codes found.</td></tr>";
    return;
  }

  body.innerHTML = window.libraryData.map((item) => {
    const name = escapeHtml(item.name || "(unnamed)");
    const status = escapeHtml(item.status);
    const destination = escapeHtml(item.destination_url);
    const trackingLink = `${window.location.origin}/t/${item.slug}`;
    const exportSize = document.getElementById('global-export-size')?.value || 400;
    const campaignPill = item.campaign
      ? `<span class="pill campaign-pill" onclick="filterByCampaign('${escapeHtml(item.campaign)}')">${escapeHtml(item.campaign)}</span>`
      : '';

    const createdDate = new Date(item.created_at).toLocaleDateString();

    return `
      <tr data-id="${item.id}">
        <td class="check-col">
          <input type="checkbox" class="qr-check" data-id="${item.id}" />
        </td>
        <td>
          <div class="qr-identity">
            <div class="qr-preview-small">
              <img src="api/qrcodes/${item.id}/download?format=png&size=100&preview=1" alt="QR" />
            </div>
            <div class="qr-info">
              <h4>${name}</h4>
              <div class="meta-row">
                <code>${item.slug}</code>
                ${campaignPill}
              </div>
            </div>
          </div>
        </td>
        <td>
          <div class="dest-link">
            <a href="${destination}" target="_blank" rel="noreferrer">${destination}</a>
          </div>
        </td>
        <td>
          <select class="small-select status-select" data-id="${item.id}">
            <option value="active" ${item.status === "active" ? "selected" : ""}>active</option>
            <option value="paused" ${item.status === "paused" ? "selected" : ""}>paused</option>
            <option value="archived" ${item.status === "archived" ? "selected" : ""}>archived</option>
          </select>
        </td>
        <td><span class="muted small">${createdDate}</span></td>
        <td><strong>${item.total_scans || 0}</strong></td>
        <td>
          <div class="actions-group">
            <button onclick="editQR(${item.id})" class="icon-btn" title="Edit">
              <i data-lucide="edit-3"></i>
            </button>
            <button onclick="copyToClipboard('${trackingLink}')" class="icon-btn" title="Copy Link">
              <i data-lucide="copy"></i>
            </button>
            <div class="download-formats">
              <a href="api/qrcodes/${item.id}/download?format=png&size=${exportSize}" title="PNG">PNG</a>
              <a href="api/qrcodes/${item.id}/download?format=svg&size=${exportSize}" title="SVG">SVG</a>
              <a href="api/qrcodes/${item.id}/download?format=pdf&size=${exportSize}" title="PDF">PDF</a>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  lucide.createIcons();
}

// --- Analytics Loading ---
async function loadAnalytics() {
  const form = document.getElementById("analytics-filter");
  const fd = new FormData(form);
  const params = new URLSearchParams();

  if (fd.get("start")) params.set("start", `${fd.get("start")}T00:00:00`);
  if (fd.get("end")) params.set("end", `${fd.get("end")}T23:59:59`);
  if (fd.get("granularity")) params.set("granularity", fd.get("granularity"));

  // specific global filters
  if (fd.get("campaign")) params.set("campaign", fd.get("campaign"));
  if (fd.get("channel")) params.set("channel", fd.get("channel"));

  const [summary, timeseries, top, breakdown] = await Promise.all([
    api(`api/analytics/summary?${params.toString()}`),
    api(`api/analytics/timeseries?${params.toString()}`),
    api(`api/analytics/top?${params.toString()}`),
    api(`api/analytics/breakdown?${params.toString()}&field=${document.getElementById('breakdown-select').value}`),
  ]);

  document.getElementById("summary").innerHTML = [
    metricCard("Total Scans", summary.total_scans),
    metricCard("Unique Users", summary.unique_scans),
    metricCard("Bot Activity", summary.bot_scans),
    metricCard("Conversions", summary.conversions),
    metricCard("Conv. Rate", `${summary.conversion_rate}%`),
  ].join("");

  updateChart(timeseries);

  document.getElementById("top-body").innerHTML = top.map(row => `
    <tr>
      <td><code>${row.slug}</code> <span class="muted">${row.name || ''}</span></td>
      <td>${row.total_scans}</td>
      <td>${row.unique_scans}</td>
    </tr>
  `).join("") || '<tr><td colspan="3" class="hint">No data for period</td></tr>';

  document.getElementById("breakdown-body").innerHTML = breakdown.map(row => `
    <tr>
      <td>${escapeHtml(row.label)}</td>
      <td>${row.total_scans}</td>
      <td>${row.unique_scans}</td>
    </tr>
  `).join("") || '<tr><td colspan="3" class="hint">No data for period</td></tr>';
}

// --- Event Handlers ---
function setupHandlers() {
  // Create QR
  document.getElementById("create-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generating...';

    try {
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      payload.auto_append_utm = fd.get('auto_append_utm') === 'on';

      const created = await api("api/qrcodes", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showToast('QR Code created successfully!');
      e.target.reset();
      loadLibrary();
      loadAnalytics();
      loadAnalyticsOptions(); // Reload options as new campaign might have been added
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });

  // Bulk Upload UI
  const fileInput = document.getElementById("csv-upload");
  const uploadBtn = document.getElementById("bulk-submit-btn");
  const labelText = document.getElementById("file-label-text");
  const feedback = document.getElementById("bulk-output");

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      uploadBtn.style.display = "inline-block";
      labelText.textContent = e.target.files[0].name;
      feedback.innerHTML = "";
    }
  });

  // Bulk Submit
  document.getElementById("bulk-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (!fd.get('file').name) return showToast('Please select a file', 'error');

    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading...";

    try {
      const res = await fetch("api/qrcodes/bulk", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(`Imported ${data.created_count} QR codes!`);

      // Feedback
      let html = `<div class="success-msg">Successfully imported ${data.created_count} codes.</div>`;
      if (data.errors && data.errors.length) {
        html += `<div class="error-msg">However, ${data.errors.length} rows failed:</div><ul>`;
        data.errors.forEach(err => {
          html += `<li>Row ${err.row}: ${err.error}</li>`;
        });
        html += `</ul>`;
      }
      feedback.innerHTML = html;

      e.target.reset();
      uploadBtn.style.display = 'none';
      labelText.textContent = "Select CSV File";
      await loadLibrary();
      loadAnalytics();
      loadAnalyticsOptions();

      if (data.created_ids && data.created_ids.length > 0) {
        // Select them
        data.created_ids.forEach(id => {
          const chk = document.querySelector(`.qr-check[data-id="${id}"]`);
          if (chk) chk.checked = true;
        });
        updateBulkToolbar();
        window.bulkEdit(data.created_ids);
      }
    } catch (err) {
      showToast(err.message, 'error');
      feedback.innerHTML = `<div class="error-msg">${err.message}</div>`;
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Upload Now";
    }
  });

  // Filters
  const libFilter = document.getElementById("library-filter");
  libFilter.addEventListener("submit", (e) => { e.preventDefault(); loadLibrary(); });
  libFilter.addEventListener("input", (e) => {
    // Debounce or just load? Let's debounce slightly if needed, or just load.
    // For select change it triggers input too
    loadLibrary();
  });

  document.getElementById("analytics-filter").addEventListener("submit", (e) => {
    e.preventDefault();
    // handled by change events mostly
    loadAnalytics();
  });

  // Auto-refresh on date/granularity change
  const analyticsForm = document.getElementById("analytics-filter");
  analyticsForm.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("change", () => loadAnalytics());
  });

  // Global Filter Change Listeners
  ["filter-campaign", "filter-channel"].forEach(id => {
    document.getElementById(id).addEventListener("change", loadAnalytics);
  });

  document.getElementById("breakdown-select").addEventListener("change", loadAnalytics);

  // Inline Status Change
  document.getElementById("library-body").addEventListener("change", async (e) => {
    if (e.target.classList.contains('status-select')) {
      const id = e.target.dataset.id;
      const status = e.target.value;
      try {
        await api(`api/qrcodes/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
        showToast(`Status updated to ${status}`);
        loadLibrary();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  // Checkbox management
  document.getElementById("select-all").addEventListener("change", (e) => {
    document.querySelectorAll(".qr-check").forEach(c => c.checked = e.target.checked);
    updateBulkToolbar();
  });

  document.getElementById("library-body").addEventListener("change", (e) => {
    if (e.target.classList.contains("qr-check")) {
      updateBulkToolbar();
    }
  });

  // Bulk Edit Form Submit
  document.getElementById("bulk-edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const ids = getSelectedIds();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(Array.from(fd.entries()).filter(([_, v]) => v !== ""));
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Updating...";
    try {
      await api("api/qrcodes/bulk_action", {
        method: "POST",
        body: JSON.stringify({ action: "update", ids, data })
      });
      showToast(`Updated ${ids.length} QR codes`);
      window.closeBulkModal();
      loadLibrary();
      loadAnalytics();
      loadAnalyticsOptions();
      clearSelection();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Update All";
    }
  });

  // Single Edit Form Submit
  document.getElementById("edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Saving...";
    try {
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      payload.auto_append_utm = fd.get('auto_append_utm') === 'on';
      const id = payload.id;
      delete payload.id;
      await api(`api/qrcodes/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      showToast("QR Code updated successfully");
      window.closeEditModal();
      loadLibrary();
      loadAnalytics();
      loadAnalyticsOptions();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = "Save Changes";
    }
  });
}

// --- Bootstrap ---
(async function init() {
  setupHandlers();
  loadAnalyticsOptions(); // Load options first but don't block
  await Promise.all([loadLibrary(), loadAnalytics()]);
})();
