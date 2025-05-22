const host = location.hostname;
const port = location.port;

let apiBaseValue;

if ((host === 'localhost' || host === '127.0.0.1') && port !== '3000' && port !== '') {
  // If on localhost/127.0.0.1 AND the port is NOT 3000 (our Express server port)
  // and port is specified (to distinguish from file:// protocol),
  // assume it's the Firebase emulator setup (which original code targeted at 5001).
  apiBaseValue = 'http://127.0.0.1:5001/siva-ab61a/us-central1/api';
} else {
  // Otherwise (e.g., on localhost:3000, or deployed, or any other local setup, or file://), use /api.
  // This will correctly target the Express server if buyer.html is served from it.
  apiBaseValue = '/api';
}
const API_BASE = apiBaseValue;

async function loadSharedList() {
  const params = new URLSearchParams(window.location.search);
  const listId = params.get('list');
  console.log('Buyer page: Attempting to load list with ID from URL:', listId); // Added log
  const ul = document.getElementById('buyer-list'); // Get ul element once

  if (!listId) {
    alert('Missing list ID in URL.');
    if (ul) ul.innerHTML = '<li>Missing list ID in URL.</li>';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/share/${listId}`);

    if (!res.ok) {
      let errorMsg = `Error ${res.status}: ${res.statusText}`;
      try {
        // Attempt to parse a JSON error response from the server
        const errorData = await res.json();
        errorMsg = errorData.error || errorData.message || errorMsg;
      } catch (e) {
        // If JSON parsing fails, stick with the original status text
        console.warn('Could not parse error response as JSON:', e);
      }
      alert(`Failed to load list: ${errorMsg}`);
      if (ul) ul.innerHTML = `<li>Failed to load list: ${errorMsg}</li>`;
      return;
    }

    const items = await res.json();

    if (!Array.isArray(items)) {
      alert('Received invalid data format from the server.');
      console.error('Expected an array of items, but received:', items);
      if (ul) ul.innerHTML = '<li>Received invalid data format from the server.</li>';
      return;
    }

    ul.innerHTML = ''; // Clear previous items

    if (items.length === 0) {
      ul.innerHTML = '<li>No items in this shared list.</li>';
      return;
    }

    items.forEach(item => {
      const li = document.createElement('li');
      // Ensure item properties exist before trying to access them
      const itemName = item && item.name ? item.name : 'N/A';
      const itemQuantity = item && item.quantity ? item.quantity : 'N/A';
      const itemId = item && item.id ? item.id : Date.now() + Math.random(); // Fallback id for safety, though should exist

      li.innerHTML = `
        <input type="checkbox" data-id="${itemId}"> ${itemName} - Qty: ${itemQuantity}
        <br>Price: ₹<input type="number" class="price" data-id="${itemId}">
        <br>Desc: <input type="text" class="desc" data-id="${itemId}">
        <hr>
      `;
      ul.appendChild(li);
    });
    // Add event listeners after items are loaded
    addBuyerEventListeners();
    updateTotal(); // Initial calculation
  } catch (error) {
    console.error('Failed to load shared list:', error);
    alert('An unexpected error occurred while loading the list. Please check the console for details.');
    if (ul) ul.innerHTML = '<li>An unexpected error occurred while loading the list.</li>';
  }
}

function updateTotal() {
  let total = 0;
  document.querySelectorAll('#buyer-list li').forEach(li => {
    const checkbox = li.querySelector('input[type="checkbox"]');
    const priceInput = li.querySelector('.price');
    if (checkbox && checkbox.checked && priceInput) {
      const price = parseFloat(priceInput.value || 0);
      total += price;
    }
  });
  const totalPriceSpan = document.getElementById('total-price');
  if (totalPriceSpan) {
    totalPriceSpan.textContent = total.toFixed(2);
  }
}

function addBuyerEventListeners() {
  const buyerList = document.getElementById('buyer-list');
  if (buyerList) {
    buyerList.addEventListener('change', (event) => {
      if (event.target.matches('input[type="checkbox"]') || event.target.matches('.price')) {
        updateTotal();
      }
    });
  }
}

async function generateAndShareMessage() {
  const updates = [...document.querySelectorAll('#buyer-list li')].map(li => {
    const checkbox = li.querySelector('input[type="checkbox"]');
    const priceInput = li.querySelector('.price');
    const descInput = li.querySelector('.desc');
    const id = checkbox ? checkbox.dataset.id : null;
    const bought = checkbox ? checkbox.checked : false;
    const price = priceInput ? parseFloat(priceInput.value || 0) : 0;
    const desc = descInput ? descInput.value : '';
    const nameElement = checkbox ? checkbox.nextSibling : null;
    let name = 'Unknown Item';
    let quantity = 'N/A';

    if (nameElement && nameElement.textContent) {
        const textContent = nameElement.textContent;
        const parts = textContent.split(' - Qty:');
        name = parts[0] ? parts[0].trim() : 'Unknown Item';
        if (parts.length > 1 && parts[1]) {
            quantity = parts[1].trim();
        }
    }
    
    return { id, name, quantity, bought, price, desc };
  });

  const boughtItems = updates.filter(item => item.bought);

  if (boughtItems.length === 0) {
    alert("No items marked as bought. Nothing to submit or share.");
    return null;
  }

  let message = "🛍️ Shopping Completed! Here's what I bought:\n\n";
  let totalPrice = 0;
  boughtItems.forEach(item => {
    message += `- ${item.name} (Qty: ${item.quantity || 'N/A'})`;
    if (item.price > 0) {
      message += ` - Price: ₹${item.price.toFixed(2)}`;
      totalPrice += item.price;
    }
    if (item.desc) {
      message += ` (Desc: ${item.desc})`;
    }
    message += '\n';
  });
  message += `\nTotal: ₹${totalPrice.toFixed(2)}`;

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const newWindow = window.open(whatsappUrl, '_blank');

  if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
    prompt(
      "Could not open WhatsApp automatically. Please copy the summary below and share it manually:",
      message
    );
  }
  return { updates, message, shared: true };
}

document.getElementById('submit').addEventListener('click', async () => {
  const result = await generateAndShareMessage();
  if (result && result.shared) {
    console.log('Sending back to server (stub):', result.updates);
    // Original alert was: // alert('✅ List marked as completed (stub)');
    // This is now handled by the WhatsApp share.
  }
});

const shareButton = document.getElementById('share-whatsapp');
if (shareButton) {
  shareButton.addEventListener('click', async () => {
    await generateAndShareMessage();
  });
}

loadSharedList();
