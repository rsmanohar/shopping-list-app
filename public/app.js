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

  const catSelect = document.getElementById('category-filter');
  // const otherSubcategoryInput = document.getElementById('other-subcategory-input'); // Keep for now if used elsewhere, or remove if fully deprecated

  catSelect.innerHTML = '<option value="">All</option>';

  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    catSelect.appendChild(opt);
  });
  // Add "Others" to category filter
  const othersOpt = document.createElement('option');
  othersOpt.value = 'Others';
  othersOpt.textContent = 'Others';
  catSelect.appendChild(othersOpt);

  // Removed subcategory population and related event listener for catSelect change affecting subSelect
  // catSelect.addEventListener('change', () => {
  //   if (catSelect.value === 'Others') {
  //     // otherSubcategoryInput.style.display = 'inline-block'; // This logic might move or change
  //   } else {
  //     // otherSubcategoryInput.style.display = 'none';
  //     // otherSubcategoryInput.value = ''; // Clear the input
  //   }
  // });
}

function renderList() {
  const catFilter = document.getElementById('category-filter').value;
  // let subcatFilter = document.getElementById('subcategory-filter').value; // Removed
  // const otherSubcategoryValue = document.getElementById('other-subcategory-input').value.trim(); // Removed

  // if (catFilter === 'Others' && otherSubcategoryValue) { // Removed
  //   subcatFilter = otherSubcategoryValue; // Use the manually entered subcategory // Removed
  // }
  const ul = document.getElementById('item-list');
  ul.innerHTML = ''; // Clear previous items

  // Add "Others" input field if a category is selected
  if (catFilter && catFilter !== 'All') {
    const otherItemLi = document.createElement('li');
    otherItemLi.style.listStyleType = 'none';
    otherItemLi.style.marginBottom = '10px';
    otherItemLi.innerHTML = `
      <input type="text" id="other-item-name" placeholder="Enter other item" style="margin-right: 5px;">
      <input type="number" id="other-item-qty" min="1" value="1" style="width: 60px; margin-right: 5px;">
      <button id="add-other-item-btn">Add Item</button>
    `;
    ul.appendChild(otherItemLi);

    // Event listener for the "Add Item" button
    // This listener should be added only once, or managed carefully if renderList is called multiple times
    // For simplicity, adding it here, but consider delegation or adding it outside if issues arise.
    const addOtherItemBtn = otherItemLi.querySelector('#add-other-item-btn');
    if (addOtherItemBtn) { // Ensure button exists before adding listener
        addOtherItemBtn.addEventListener('click', async () => {
            const itemNameInput = document.getElementById('other-item-name');
            const itemQtyInput = document.getElementById('other-item-qty');
            const itemName = itemNameInput.value.trim();
            const itemQty = parseInt(itemQtyInput.value, 10) || 1;
            const currentCategory = document.getElementById('category-filter').value; // Get current category

            if (itemName && currentCategory && currentCategory !== 'All') {
                const newItemData = {
                    name: itemName,
                    category: currentCategory,
                    quantity: itemQty
                };

                try {
                    const res = await fetch(`${API_BASE}/items`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newItemData)
                    });

                    if (!res.ok) {
                        const errorData = await res.json();
                        throw new Error(errorData.error || `Error ${res.status}`);
                    }

                    const savedItem = await res.json();
                    
                    // Add to local 'items' array to make it appear in the list
                    items.push(savedItem);
                    
                    // Add to selectedItems as well, using the ID from the database
                    selectedItems[savedItem.id] = { ...savedItem, quantity: itemQty };
                    
                    populateFilters(); // Re-populate filters in case new categories were added (though unlikely here)
                    renderList(); // Re-render the list to show the new item from 'items'
                    renderSelectedView(); // Update the selected items display

                    itemNameInput.value = ''; // Clear input
                    itemQtyInput.value = '1'; // Reset quantity input

                } catch (error) {
                    console.error("Failed to add new item:", error);
                    alert(`Failed to add item: ${error.message}`);
                }
            } else if (!itemName) {
                alert("Please enter an item name.");
            } else {
                alert("Please select a category before adding an 'other' item.");
            }
        });
    }
  }


  if (!catFilter || catFilter === 'All') { // Adjusted condition
    const li = document.createElement('li');
    li.textContent = 'Please select a category to view items.'; // Updated message
    li.style.textAlign = 'center';
    li.style.padding = '1rem';
    li.style.color = '#555';
    ul.appendChild(li);
  } else {
    items.filter(item => {
      const categoryMatch = !catFilter || item.category === catFilter || (catFilter === 'Others' && item.category === 'Others');
      // const subcategoryMatch = !subcatFilter || item.subcategory === subcatFilter || (catFilter === 'Others' && otherSubcategoryValue && item.subcategory.toLowerCase() === otherSubcategoryValue.toLowerCase()); // Removed
      return categoryMatch; // Only category match
    }
    ).forEach(item => {
      const li = document.createElement('li');
      li.style.listStyleType = 'none';
      const checked = selectedItems[item.id] ? 'checked' : '';
      const qty = selectedItems[item.id]?.quantity || 1;

      li.innerHTML = `
        <label>
          <input type="checkbox" data-id="${item.id}" ${checked}>
          ${item.name}
          (<input type="number" class="qty-input" data-id="${item.id}" min="1" value="${qty}" style="width: 50px; margin-left: 5px; margin-right: 5px;"> Qty)
        </label>
      `;
      ul.appendChild(li);
    });
  }
}

function updateSelectedItems() {
  document.querySelectorAll('#item-list input[type="checkbox"]').forEach(cb => {
    const id = cb.dataset.id;
    const qtyInput = document.querySelector(`.qty-input[data-id="${id}"]`);
    const qty = qtyInput ? parseInt(qtyInput.value, 10) : 1; // Default to 1 if qty-input not found (e.g. for "Other" items added without it)
    
    // Try to find in existing items, or use the one from selectedItems if it's an "Other" item
    let item = items.find(i => i.id == id);
    if (!item && selectedItems[id]) { // For "Other" items not in the main 'items' list
        item = selectedItems[id];
    }


    if (cb.checked && item) {
      const catFilter = document.getElementById('category-filter').value;
      // const otherSubcategoryValue = document.getElementById('other-subcategory-input').value.trim(); // Removed
      // let subcategory = item.subcategory; // Removed
      // if (catFilter === 'Others' && otherSubcategoryValue) { // Removed
      //   subcategory = otherSubcategoryValue; // Removed
      // }
      // Ensure category is correctly assigned, especially for items from the main list vs. "Other" items
      let currentCategory = item.category;
      if (catFilter && catFilter !== "All" && catFilter !== "Others") {
          currentCategory = catFilter;
      } else if (catFilter === "Others") {
          currentCategory = "Others";
      }

      selectedItems[id] = { ...item, quantity: qty, category: currentCategory }; // Removed subcategory
    } else {
      delete selectedItems[id];
    }
  });
  renderSelectedView();
}

function renderSelectedView() {
  const container = document.getElementById('selected-items');
  container.innerHTML = '<h3>Selected Items:</h3>';
  if (Object.keys(selectedItems).length === 0) {
    container.innerHTML += '<p>No items selected yet.</p>';
  } else {
    Object.values(selectedItems).forEach(item => {
      const div = document.createElement('div');
      let displayText = `✅ ${item.name} (Qty: ${item.quantity}, Category: ${item.category || 'N/A'})`; // Display category
      // if (item.category === 'Others' && item.subcategory) { // Removed subcategory display
      //   displayText += ` (Subcategory: ${item.subcategory})`;
      // }
      div.textContent = displayText;
      container.appendChild(div);
    });
  }
}

document.getElementById('category-filter').addEventListener('change', () => {
  renderList(); // This will now also set up the "Add Other Item" button listener if a category is chosen
  updateSelectedItems(); // updateSelectedItems might need to be called after an item is added via "Add Other Item" too
});
// document.getElementById('subcategory-filter').addEventListener('change', () => { // Removed
//   renderList();
//   updateSelectedItems();
// });

// document.getElementById('other-subcategory-input').addEventListener('input', () => { // Removed
//   if (document.getElementById('category-filter').value === 'Others') {
//     renderList();
//     updateSelectedItems();
//   }
// });

document.getElementById('item-list').addEventListener('change', (event) => {
    // Only call updateSelectedItems if the change is from a checkbox or qty-input,
    // not from the "Add Other Item" button click (which has its own logic).
    if (event.target.type === 'checkbox' || event.target.classList.contains('qty-input')) {
        updateSelectedItems();
    }
});


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
      body: JSON.stringify(payload.map(item => ({ // Ensure only relevant data is sent
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          category: item.category
          // subcategory is removed
      })))
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
      let messageItems = "Here's the shopping list:\n";
      Object.values(selectedItems).forEach(item => {
        let itemText = `- ${item.name} (Qty: ${item.quantity}, Category: ${item.category || 'N/A'})`;
        // if (item.category === 'Others' && item.subcategory) { // Removed
        //   itemText += ` (Subcategory: ${item.subcategory})`; // Removed
        // }
        messageItems += itemText + '\n';
      });
      const whatsappMessage = `${messageItems}\nView the full list here: ${buyerLink}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

      const newWindow = window.open(whatsappUrl, '_blank');
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        // Fallback: Display the link on the page
        const shareFeedback = document.getElementById('share-feedback') || document.createElement('div');
        shareFeedback.id = 'share-feedback';
        shareFeedback.innerHTML = `
          <p>Could not open WhatsApp automatically. Please share this link with the buyer:</p>
          <a href="${buyerLink}" target="_blank">${buyerLink}</a>
        `;
        // Insert after the share button or selected items container
        const shareButton = document.getElementById('share');
        if (shareButton) {
          shareButton.insertAdjacentElement('afterend', shareFeedback);
        } else {
          // Fallback if share button not found, append to selected items
          document.getElementById('selected-items').appendChild(shareFeedback);
        }
      } else {
        // Clear any previous fallback message if window.open succeeded
        const existingFeedback = document.getElementById('share-feedback');
        if (existingFeedback) {
          existingFeedback.remove();
        }
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
