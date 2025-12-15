
(async function () {
  // Config
  const campusName = "gh raisoni wadi";
  const rows = 10;
  const cols = 14;

  const studentParkingCoords = [
    [21.1232, 79.0030],
    [21.1232, 79.0040],
    [21.1240, 79.0040],
    [21.1240, 79.0030]
  ];

  const latStart = studentParkingCoords[0][0];
  const latEnd = studentParkingCoords[2][0];
  const lonStart = studentParkingCoords[0][1];
  const lonEnd = studentParkingCoords[2][1];

  const slotsDiv = document.getElementById('slots');
  const loadingEl = document.getElementById('loading');
  const bookBtn = document.getElementById('bookBtn');
  const minAllBtn = document.getElementById('minAll');
  const maxAllBtn = document.getElementById('maxAll');

  let selectedSlot = null;
  const slotData = []; 
  const map = L.map('map', { minZoom: 17, maxZoom: 22 }).setView([21.1236, 79.0035], 19);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  
  L.polygon(studentParkingCoords, { color: '#00b300', weight: 2, fillOpacity: 0.05 }).addTo(map);

  
  const latStep = (rows === 1) ? 0 : (latEnd - latStart) / (rows - 1);
  const lonStep = (cols === 1) ? 0 : (lonEnd - lonStart) / (cols - 1);

  
  loadingEl.textContent = 'Loading slots…';
  bookBtn.disabled = true;
  bookBtn.setAttribute('aria-disabled', 'true');

  let bookedSlots = [];
  try {
    const resp = await fetch("/get_booked_slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campus: campusName })
    });
    if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
    bookedSlots = await resp.json();
    if (!Array.isArray(bookedSlots)) bookedSlots = [];
  } catch (err) {
    console.error("Failed to fetch booked slots:", err);
    loadingEl.textContent = 'Failed to load slots. Please refresh.';
    
  }

  
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const lat = latStart + i * latStep;
      const lon = lonStart + j * lonStep;
      const slotId = `R${i+1}C${j+1}`;
      const booked = bookedSlots.includes(slotId);
      
      const color = booked ? '#ff4d4d' : '#00b300';

      const marker = L.circleMarker([lat, lon], { radius: 4.5, color: color, fillOpacity: 1 }).addTo(map);
      marker.slotId = slotId;
      marker.booked = booked;

      
      marker.on('click', function (e) {
        const content = createPopupContent(marker);
        marker.bindPopup(content, { autoClose: false, closeOnClick: false }).openPopup();
        
        setTimeout(() => {
          const popupNode = marker.getPopup().getElement();
          if (!popupNode) return;
          const btn = popupNode.querySelector(".popup-btn");
          if (btn) {
            btn.onclick = async (ev) => {
              ev.preventDefault();
              if (marker.booked) return;
              await bookSlot(marker.slotId, marker);
            };
          }
        }, 50);
      });

      // Save
      slotData.push({ id: slotId, marker: marker, booked: booked });
    }
  }

  // Done 
  loadingEl.textContent = '';
  bookBtn.disabled = true;
  bookBtn.setAttribute('aria-disabled', 'true');

  renderSlotList();

  // Create slot list UI
  function renderSlotList() {
    slotsDiv.innerHTML = '';
    slotData.forEach(slot => {
      const slotEl = document.createElement('div');
      slotEl.className = 'slot';
      slotEl.id = slot.id;
      slotEl.setAttribute('role', 'listitem');

      slotEl.innerHTML = `
        <div class="slot-header" tabindex="0" aria-label="Select slot ${slot.id}">
          <div class="slot-id">${slot.id}</div>
          <button class="toggle-btn" aria-label="Toggle details for ${slot.id}">➕</button>
        </div>
        <div class="slot-details" aria-hidden="true">
          <p>Size: Standard</p>
          <p>Near Entrance: Yes</p>
          <p>Status: <span class="${slot.booked ? 'status-booked' : 'status-available'}">${slot.booked ? 'Booked' : 'Available'}</span></p>
        </div>
      `;

      // Selection behaviour only on header (not whole slot)
      const header = slotEl.querySelector('.slot-header');
      header.addEventListener('click', (e) => {
        selectSlot(slot.id);
      });
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectSlot(slot.id);
        }
      });

      
      const toggleBtn = slotEl.querySelector('.toggle-btn');
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSlot(slotEl);
      });

      slotsDiv.appendChild(slotEl);
    });
  }

  function selectSlot(slotId) {
    document.querySelectorAll(".slot").forEach(s => s.classList.remove("selected"));
    const el = document.getElementById(slotId);
    if (!el) return;
    el.classList.add("selected");
    selectedSlot = slotId;
    const slot = slotData.find(s => s.id === slotId);
    if (slot) {
      
      bookBtn.disabled = slot.booked;
      bookBtn.setAttribute('aria-disabled', slot.booked ? 'true' : 'false');
      map.panTo(slot.marker.getLatLng(), { animate: true, duration: 0.3 });
      
      slot.marker.fire('click');
    }
  }

  // Toggle details
  function toggleSlot(slotEl) {
    const details = slotEl.querySelector(".slot-details");
    const visible = details.style.display === "block";
    details.style.display = visible ? "none" : "block";
    details.setAttribute('aria-hidden', visible ? 'true' : 'false');
    slotEl.querySelector(".toggle-btn").textContent = visible ? "➕" : "➖";
  }

  function minimizeAll() {
    document.querySelectorAll(".slot-details").forEach(d => {
      d.style.display = "none";
      d.setAttribute('aria-hidden', 'true');
    });
    document.querySelectorAll(".toggle-btn").forEach(b => b.textContent = "➕");
  }

  function maximizeAll() {
    document.querySelectorAll(".slot-details").forEach(d => {
      d.style.display = "block";
      d.setAttribute('aria-hidden', 'false');
    });
    document.querySelectorAll(".toggle-btn").forEach(b => b.textContent = "➖");
  }

  // Attach control buttons
  minAllBtn.addEventListener('click', minimizeAll);
  maxAllBtn.addEventListener('click', maximizeAll);

  // Book selected slot (from side panel)
  window.bookSelectedSlot = async function () {
    if (!selectedSlot) return alert('Select a slot first.');
    const slot = slotData.find(s => s.id === selectedSlot);
    if (!slot) return alert('Slot not found.');
    if (slot.booked) return alert('Slot already booked.');
    await bookSlot(slot.id, slot.marker);
  };

  // Book slot helper - sends request and updates UI
  async function bookSlot(slotId, marker) {
    try {
      const resp = await fetch("/book_slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: slotId, campus: campusName })
      });
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      const data = await resp.json();
      if (!data || !data.status) throw new Error('Invalid server response');

      alert(data.message || 'Action complete');
      if (data.status === "success") {
        // update local state
        const slot = slotData.find(s => s.id === slotId);
        if (slot) {
          slot.booked = true;
          slot.marker.booked = true;
          // change color to booked: red
          slot.marker.setStyle({ color: '#ff4d4d' });

          // update the side panel's status
          const slotDiv = document.getElementById(slotId);
          if (slotDiv) {
            const statusSpan = slotDiv.querySelector(".slot-details span");
            if (statusSpan) {
              statusSpan.className = 'status-booked';
              statusSpan.innerText = 'Booked';
            }
          }
          // disable book button on side panel if selected
          if (selectedSlot === slotId) {
            bookBtn.disabled = true;
            bookBtn.setAttribute('aria-disabled', 'true');
          }

          // update popup content if open
          const popup = slot.marker.getPopup();
          if (popup && map.hasLayer(popup)) {
            popup.setContent(createPopupContent(slot.marker));
            popup.update();
          }
        }
      }
    } catch (err) {
      console.error("Booking failed:", err);
      alert("Booking failed. Please try again.");
    }
  }

  
  function createPopupContent(marker) {
    const booked = !!marker.booked;
    const disabledText = booked ? 'disabled' : '';
    const statusText = booked ? '<span style="color:#c30000;font-weight:700">Booked</span>' : '<span style="color:#007a00;font-weight:700">Available</span>';
    
    return `
      <div>
        <div style="font-weight:700;margin-bottom:6px">Parking Slot</div>
        <div style="margin-bottom:6px">${marker.slotId}</div>
        <div style="margin-bottom:6px">Status: ${statusText}</div>
        <button class="popup-btn" ${disabledText}>Book This Spot</button>
      </div>
    `;
  }

})();
<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

          // -------------------------
          // CONFIG: Gate definitions
          // -------------------------
          // Replace lat/lng below with accurate gate coordinates for your campus.
          const gates = [
            { id: 'main-gate', name: 'Main Gate', lat: 21.12345, lon: 79.00375, slotsText: '30 / 50', color: '#4285f4' },
            { id: 'back-gate', name: 'Back Gate', lat: 21.12395, lon: 79.00400, slotsText: '12 / 20', color: '#34a853' },
            { id: 'hostel-gate', name: 'Hostel Gate', lat: 21.12330, lon: 79.00320, slotsText: '18 / 40', color: '#fbbc05' },
            { id: 'parking-lot', name: 'Parking Lot', lat: 21.12375, lon: 79.00395, slotsText: '40 / 70', color: '#ea4335' }
          ];

          const campusName = "gh raisoni wadi";

          // -------------------------
          // Initialize map (your original params)
          // -------------------------
          const studentParkingCoords = [
            [21.1232, 79.0030],
            [21.1232, 79.0040],
            [21.1240, 79.0040],
            [21.1240, 79.0030]
          ];

          const map = L.map('map', { minZoom: 17, maxZoom: 22 }).setView([21.1236, 79.0035], 19);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);

          L.polygon(studentParkingCoords, { color: '#00b300', weight: 2, fillOpacity: 0.05 }).addTo(map);

          // -------------------------
          // Helper: haversine distance (km)
          // -------------------------
          function haversineKm(lat1, lon1, lat2, lon2) {
            const R = 6371; // km
            const toRad = deg => deg * Math.PI / 180;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
          }

          // -------------------------
          // Create gate markers (DivIcon) with bubble-popups, bounce, auto-pan
          // -------------------------
          const gateMarkers = [];

          gates.forEach(g => {
            const html = `<span class="gate-dot" style="background:${g.color};"></span>`;
            const icon = L.divIcon({
              className: 'gate-divicon',
              html: html,
              iconSize: [22, 22],
              iconAnchor: [11, 22]
            });

            const marker = L.marker([g.lat, g.lon], { icon: icon, riseOnHover: true }).addTo(map);

            // Popup/bubble HTML (initially shows calculating distance)
            const popupHtml = `
              <div class="gate-bubble">
                <div class="bubble-head">
                  <strong>${g.name}</strong>
                </div>
                <div class="bubble-body">
                  <div class="bubble-row"><span>Slots:</span> <span class="slots-text">${g.slotsText}</span></div>
                  <div class="bubble-row"><span>Distance:</span> <span class="distance-text">Calculating...</span></div>
                </div>
                <div class="bubble-actions">
                  <button class="btn-go" data-gate="${g.id}">Show Slots</button>
                </div>
              </div>
            `;

            marker.bindPopup(popupHtml, { closeButton: true, offset: [0, -20], className: 'gate-popup' });

            // Bounce on add
            marker.on('add', () => {
              const el = marker._icon;
              if (!el) return;
              el.classList.add('gate-bounce');
              el.addEventListener('animationend', () => el.classList.remove('gate-bounce'), { once: true });
            });

            // On click: open popup and pan to marker so popup is visible (auto-adjust)
            marker.on('click', () => {
              marker.openPopup();
              // ensure popup fits in viewport by panning slightly upward
              map.panTo(marker.getLatLng(), { animate: true, duration: 0.35 });
            });

            // When popup opens, compute distance (if user grants geolocation)
            marker.on('popupopen', (ev) => {
              const popupNode = ev.popup.getElement();
              if (!popupNode) return;
              const distEl = popupNode.querySelector('.distance-text');
              const goBtn = popupNode.querySelector('.btn-go');

              // attach go button: pan to parking polygon & highlight nearest slot (optional)
              if (goBtn) {
                goBtn.onclick = () => {
                  // Pan to parking area center and open slot list (you can customize)
                  map.panTo([21.1236, 79.0035], { animate: true });
                  // Optionally highlight gate marker
                  ev.popup._source._icon.classList.add('pulse-highlight');
                  setTimeout(() => ev.popup._source._icon.classList.remove('pulse-highlight'), 1200);
                };
              }

              // compute distance
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(position => {
                  const userLat = position.coords.latitude;
                  const userLon = position.coords.longitude;
                  const km = haversineKm(userLat, userLon, g.lat, g.lon);
                  // show meters if <1 km
                  const text = km < 1 ? `${Math.round(km*1000)} m` : `${km.toFixed(2)} km`;
                  if (distEl) distEl.textContent = text;
                }, () => {
                  if (distEl) distEl.textContent = 'Unavailable';
                }, { maximumAge: 60_000, timeout: 5000 });
              } else {
                if (distEl) distEl.textContent = 'Geolocation unsupported';
              }
            });

            gateMarkers.push(marker);
          });

          // -------------------------
          // Keep your original slot generation + booking logic below (unchanged),
          // I simply append it so it integrates with the gate markers above.
          // -------------------------
          const slotData = [];
          const rows = 10;
          const cols = 14;
          const latStart = studentParkingCoords[0][0];
          const latEnd = studentParkingCoords[2][0];
          const lonStart = studentParkingCoords[0][1];
          const lonEnd = studentParkingCoords[2][1];

          let selectedSlot = null;

          fetch("/get_booked_slots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campus: campusName })
          })
          .then(res => res.json())
          .then(bookedSlots => {
            for (let i = 0; i < rows; i++) {
              for (let j = 0; j < cols; j++) {
                const lat = latStart + i * (latEnd - latStart) / rows;
                const lon = lonStart + j * (lonEnd - lonStart) / cols;
                const slotId = `R${i+1}C${j+1}`;
                const booked = bookedSlots.includes(slotId);
                const color = booked ? '#00b300' : '#ff0000';

                const marker = L.circleMarker([lat, lon], { radius: 4, color: color, fillOpacity: 1 }).addTo(map);
                marker.slotId = slotId;
                marker.booked = booked;

                marker.bindPopup(`
                  <b>Parking Slot</b><br>${slotId}<br>
                  <button class="popup-btn" ${booked ? "disabled" : ""}>Book This Spot</button>
                `, { autoClose: false, closeOnClick: false });

                marker.on('popupopen', function(e) {
                  const btn = e.popup._contentNode.querySelector(".popup-btn");
                  if (btn) {
                    btn.onclick = function() {
                      if (!marker.booked) bookSlot(marker.slotId, marker);
                    };
                  }
                });

                slotData.push({ id: slotId, marker: marker, booked: booked });
              }
            }
            renderSlotList();
          });

          function renderSlotList() {
            const slotsDiv = document.getElementById('slots');
            slotsDiv.innerHTML = "";
            slotData.forEach(slot => {
              const slotEl = document.createElement('div');
              slotEl.className = 'slot';
              slotEl.id = slot.id;
              slotEl.innerHTML = `
                <div class='slot-header'>
                  ${slot.id} <button class='toggle-btn'>➕</button>
                </div>
                <div class='slot-details'>
                  <p>Size: Standard</p>
                  <p>Near Entrance: Yes</p>
                  <p>Status: ${slot.booked ? "Booked" : "Available"}</p>
                </div>
              `;
              slotEl.onclick = () => selectSlot(slotEl);
              slotEl.querySelector(".toggle-btn").onclick = e => { e.stopPropagation(); toggleSlot(slotEl); };
              slotsDiv.appendChild(slotEl);
            });
          }

          function selectSlot(element) {
            document.querySelectorAll(".slot").forEach(s => s.classList.remove("selected"));
            element.classList.add("selected");
            selectedSlot = element.id;
            const slot = slotData.find(s => s.id === selectedSlot);
            document.getElementById("bookBtn").disabled = slot.booked;
            if (slot) map.panTo(slot.marker.getLatLng());
          }

          function toggleSlot(slotEl) {
            const details = slotEl.querySelector(".slot-details");
            const visible = details.style.display === "block";
            details.style.display = visible ? "none" : "block";
            slotEl.querySelector(".toggle-btn").textContent = visible ? "➕" : "➖";
          }

          function minimizeAll() {
            document.querySelectorAll(".slot-details").forEach(d => d.style.display = "none");
            document.querySelectorAll(".toggle-btn").forEach(b => b.textContent = "➕");
          }

          function maximizeAll() {
            document.querySelectorAll(".slot-details").forEach(d => d.style.display = "block");
            document.querySelectorAll(".toggle-btn").forEach(b => b.textContent = "➖");
          }

          function bookSelectedSlot() {
            if (selectedSlot) {
              const slot = slotData.find(s => s.id === selectedSlot);
              if (!slot.booked) bookSlot(selectedSlot, slot.marker);
            }
          }

          function bookSlot(slotId, marker) {
            fetch("/book_slot", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slot_id: slotId, campus: campusName })
            })
            .then(res => res.json())
            .then(data => {
              alert(data.message);
              if (data.status === "success") {
                const slot = slotData.find(s => s.id === slotId);
                slot.booked = true;
                marker.setStyle({ color: "#00b300" });
                const slotDiv = document.getElementById(slotId);
                if (slotDiv) slotDiv.querySelector(".slot-details p:last-child").innerText = "Status: Booked";
                document.getElementById("bookBtn").disabled = true;
              }
            });
          }

