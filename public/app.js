const API_BASE = '/api';
let items = [];
let selectedItems = {}; // Keep as map by ID for persistence

async function loadItems() {
  const res = await fetch(`${API_BASE}/items`);
  items = await res.json();
  populateFilters();
  renderList();
  renderSelectedView();
}

function populateFilters() {
  const categories = [...new Set(items.map(item => item.category))];
  const subcategories = [...new Set(items.map(item => item.subcategory))];

  const catSelect = document.getElementById('category-filter');
  const subSelect = document.getElementById('subcategory-filter');

  catSelect.innerHTML = '<option value="">All</option>';
  subSelect.innerHTML = '<option value="">All</option>';

  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    catSelect.appendChild(opt);
  });

  subcategories.forEach(sub => {
    const opt = document.createElement('option');
    opt.value = sub;
    opt.textContent = sub;
    subSelect.appendChild(opt);
  });
}

function renderList() {
  const catFilter = document.getElementById('category-filter').value;
  const subcatFilter = document.getElementById('subcategory-filter').value;
  const ul = document.getElementById('item-list');
  ul.innerHTML = '';

  if (!catFilter && !subcatFilter) {
    const li = document.createElement('li');
    li.textContent = 'Please select a category or subcategory to view items.';
    li.style.textAlign = 'center';
    li.style.padding = '1rem';
    li.style.color = '#555';
    ul.appendChild(li);
  } else {
    items.filter(item =>
      (!catFilter || item.category === catFilter) &&
      (!subcatFilter || item.subcategory === subcatFilter)
    ).forEach(item => {
      const li = document.createElement('li');
      li.style.listStyleType = 'none';
      const checked = selectedItems[item.id] ? 'checked' : '';
      const qty = selectedItems[item.id]?.quantity || 1;

      li.innerHTML = `
        <label>
          <input type="checkbox" data-id="${item.id}" ${checked}>
          ${item.name} -
          Qty: <input type="number" class="qty-input" data-id="${item.id}" min="1" value="${qty}">
        </label>
      `;
      ul.appendChild(li);
    });
  }
}

function updateSelectedItems() {
  document.querySelectorAll('#item-list input[type="checkbox"]').forEach(cb => {
    const id = cb.dataset.id;
    const qty = parseInt(document.querySelector(`.qty-input[data-id="${id}"]`)?.value || '1', 10);
    const item = items.find(i => i.id == id);

    if (cb.checked && item) {
      selectedItems[id] = { ...item, quantity: qty };
    } else {
      delete selectedItems[id];
    }
  });
  renderSelectedView();
}

function renderSelectedView() {
  const container = document.getElementById('selected-items');
  container.innerHTML = '<h3>Selected Items:</h3>';
  Object.values(selectedItems).forEach(item => {
    const div = document.createElement('div');
    div.textContent = `✅ ${item.name} - Qty: ${item.quantity}`;
    container.appendChild(div);
  });
}

document.getElementById('category-filter').addEventListener('change', () => {
  renderList();
  updateSelectedItems();
});
document.getElementById('subcategory-filter').addEventListener('change', () => {
  renderList();
  updateSelectedItems();
});
document.getElementById('item-list').addEventListener('change', updateSelectedItems);

document.getElementById('share').addEventListener('click', async () => {
  const payload = Object.values(selectedItems);

  if (payload.length === 0) {
    alert("Please select items to share.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      // Try to get error message from server response
      let errorMsg = `Error ${res.status}: ${res.statusText}`;
      try {
        const errorData = await res.json();
        errorMsg = errorData.error || errorData.message || errorMsg;
      } catch (e) {
        // Ignore if response is not JSON
      }
      throw new Error(`Failed to create share link: ${errorMsg}`);
    }

    const data = await res.json();
    if (data && data.id) {
      const buyerLink = `${location.origin}/buyer.html?list=${data.id}`;
      const whatsappMessage = `Please find the shopping list here: ${buyerLink}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

      const newWindow = window.open(whatsappUrl, '_blank');
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        prompt(
          "Could not open WhatsApp automatically. Please copy the link below and share it with the buyer:",
          buyerLink
        );
      }
    } else {
      throw new Error("Received invalid response from server when creating share link.");
    }
  } catch (error) {
    console.error("Error sharing list:", error);
    alert(`Could not create share link: ${error.message}`);
  }
});

loadItems();
