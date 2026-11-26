document.addEventListener('DOMContentLoaded', async () => {
    const localUser = JSON.parse(localStorage.getItem('user'));
    if (!localUser || String(localUser.role).toLowerCase() !== 'admin') {
        window.location.href = '../index.html';
        return;
    }

    try {
        const authRes = await fetch('../backend/api/me.php', {
            credentials: 'same-origin',
            cache: 'no-store'
        });
        const authData = await authRes.json();

        if (!authRes.ok || !authData.authenticated || String(authData.role).toLowerCase() !== 'admin') {
            localStorage.removeItem('user');
            window.location.href = '../index.html';
            return;
        }
    } catch (error) {
        window.location.href = '../index.html';
        return;
    }
    const tbody = document.getElementById('products-tbody');
    const toggleFormBtn = document.getElementById('toggle-form-btn');
    const cancelFormBtn = document.getElementById('cancel-form-btn');
    const formSection = document.getElementById('product-form-section');
    const productForm = document.getElementById('product-form');
    const formTitle = document.getElementById('form-title');
    const saveProductBtn = document.getElementById('save-product-btn');

    const prodPriceInput = document.getElementById('prod-price');
    const prodImagesInput = document.getElementById('prod-images');
    const baseImagesPreview = document.getElementById('base-images-preview');

    // Dropdown de Categorías
    const categoryDropdownBtn = document.getElementById('category-dropdown-btn');
    const categoryDropdownMenu = document.getElementById('category-dropdown-menu');
    const selectedCategoriesLabel = document.getElementById('selected-categories-label');

    // Constructor de Propiedades Dinámicas y Variantes
    const propertiesContainer = document.getElementById('dynamic-properties-container');
    const addPropertyBtn = document.getElementById('add-property-btn');
    const generateVariantsBtn = document.getElementById('generate-variants-btn');
    const variantsTbody = document.getElementById('variants-tbody');

    let products = [];
    let selectedCategories = [];
    let currentVariantsState = [];
    let lastKnownBasePrice = 0;
    let isSubmitting = false; // Bloqueo estricto contra doble envío

    // Utilidad: parsear múltiples URLs separadas por comas o saltos de línea
    function parseUrls(rawText) {
        if (!rawText) return [];
        return rawText
            .split(/[\r\n,]+/)
            .map(u => u.trim())
            .filter(u => u !== '');
    }

    // Utilidad: parsear precio con punto decimal (convierte coma decimal si se escribió por error)
    function parseDecimalPrice(rawVal) {
        if (rawVal === null || rawVal === undefined) return 0;
        const normalized = String(rawVal).trim().replace(',', '.');
        const num = parseFloat(normalized);
        return isNaN(num) || num < 0 ? 0 : Math.round(num * 100) / 100;
    }

    // Vista previa de las imágenes base
    function updateBaseImagesPreview() {
        const urls = parseUrls(prodImagesInput.value);
        baseImagesPreview.innerHTML = urls.map(url => `
            <img src="${url}" alt="Preview" class="rounded-1 border" style="width: 44px; height: 44px; object-fit: cover;" onerror="this.style.display='none'">
        `).join('');
    }

    prodImagesInput.addEventListener('input', updateBaseImagesPreview);

    // Sincronizar automáticamente variantes que aún tengan el precio base anterior
    prodPriceInput.addEventListener('input', () => {
        const newBasePrice = parseDecimalPrice(prodPriceInput.value);
        const variantPriceInputs = variantsTbody.querySelectorAll('.var-price-input');

        variantPriceInputs.forEach(input => {
            const currentVal = parseDecimalPrice(input.value);
            if (currentVal === lastKnownBasePrice || input.value.trim() === '') {
                input.value = newBasePrice.toFixed(2);
            }
        });

        lastKnownBasePrice = newBasePrice;
    });

    // 1. Cargar productos desde MySQL
    async function fetchProducts() {
        try {
            const response = await fetch(`../backend/api/products.php?t=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error('Error al obtener productos');
            products = await response.json();
            localStorage.setItem('currentProducts', JSON.stringify(products));
            renderTable();
        } catch (error) {
            console.error('Error cargando productos:', error);
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Error loading products from database.</td></tr>`;
        }
    }

    // 2. Cargar categorías desde MySQL al abrir el dropdown
    async function loadCategoriesDropdown() {
        categoryDropdownMenu.innerHTML = `<li class="text-muted small py-1"><i class="fa-solid fa-spinner fa-spin me-2"></i>Loading categories...</li>`;

        try {
            const response = await fetch(`../backend/api/categories.php?t=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error('Error al cargar categorías');

            const categories = await response.json();
            categoryDropdownMenu.innerHTML = '';

            categories.forEach(cat => {
                const isAll = cat.name.toLowerCase() === 'all';
                const isChecked = isAll || selectedCategories.some(c => c.toLowerCase() === cat.name.toLowerCase());

                const li = document.createElement('li');
                li.className = 'mb-2';
                li.innerHTML = `
                    <label class="d-flex align-items-center gap-2 user-select-none mb-0" style="cursor: pointer;">
                        <input type="checkbox" 
                               class="form-check-input mt-0 category-option-check" 
                               value="${cat.name}" 
                               ${isChecked ? 'checked' : ''} 
                               ${isAll ? 'disabled' : ''}>
                        <span class="${isAll ? 'fw-semibold text-dark-custom' : 'text-dark-custom'}">
                            ${cat.name} ${isAll ? '<small class="text-muted">(Default)</small>' : ''}
                        </span>
                    </label>
                `;
                categoryDropdownMenu.appendChild(li);
            });

            categoryDropdownMenu.querySelectorAll('.category-option-check:not(:disabled)').forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    selectedCategories = Array.from(
                        categoryDropdownMenu.querySelectorAll('.category-option-check:not(:disabled):checked')
                    ).map(cb => cb.value);
                    updateCategoryButtonLabel();
                });
            });

        } catch (error) {
            console.error('Error cargando categorías:', error);
            categoryDropdownMenu.innerHTML = `<li class="text-danger small">Error loading categories.</li>`;
        }
    }

    function updateCategoryButtonLabel() {
        if (selectedCategories.length === 0) {
            selectedCategoriesLabel.textContent = 'All (Default)';
        } else {
            selectedCategoriesLabel.textContent = `All, ${selectedCategories.join(', ')}`;
        }
    }

    if (categoryDropdownBtn) {
        categoryDropdownBtn.addEventListener('click', loadCategoriesDropdown);
    }

    // 3. Constructor de Propiedades Libres
    function addPropertyRow(name = '', values = '') {
        const row = document.createElement('div');
        row.className = 'row g-2 align-items-center property-builder-row bg-white p-2 rounded-1 border custom-border-light';
        row.innerHTML = `
            <div class="col-12 col-md-4">
                <input type="text" class="form-control simple-input prop-name-input" placeholder="Property name (e.g. Color)" value="${name}">
            </div>
            <div class="col-10 col-md-7">
                <input type="text" class="form-control simple-input prop-values-input" placeholder="Values comma-separated (e.g. Azul, Rojo)" value="${values}">
            </div>
            <div class="col-2 col-md-1 text-end">
                <button type="button" class="btn btn-sm btn-outline-danger remove-prop-btn" title="Remove property">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;

        row.querySelector('.prop-name-input').addEventListener('input', syncVariantsFromProperties);
        row.querySelector('.prop-values-input').addEventListener('input', syncVariantsFromProperties);

        row.querySelector('.remove-prop-btn').addEventListener('click', () => {
            row.remove();
            syncVariantsFromProperties();
        });

        propertiesContainer.appendChild(row);
    }

    addPropertyBtn.addEventListener('click', () => addPropertyRow());
    generateVariantsBtn.addEventListener('click', () => syncVariantsFromProperties());

    function getDefinedOptions() {
        const rows = propertiesContainer.querySelectorAll('.property-builder-row');
        const options = [];

        rows.forEach(row => {
            const name = row.querySelector('.prop-name-input').value.trim();
            const rawVals = row.querySelector('.prop-values-input').value;
            const values = rawVals
                .split(',')
                .map(v => v.trim())
                .filter(v => v !== '');

            if (name !== '' && values.length > 0) {
                options.push({
                    name,
                    values: [...new Set(values)]
                });
            }
        });

        return options;
    }

    function getAttributesSignature(attrsObj) {
        if (!attrsObj || typeof attrsObj !== 'object') return 'DEFAULT';
        const keys = Object.keys(attrsObj).sort();
        if (keys.length === 0) return 'DEFAULT';
        return keys.map(k => `${k.toLowerCase()}:${String(attrsObj[k]).toLowerCase()}`).join('|');
    }

    function captureCurrentTableInputs() {
        const variantRows = variantsTbody.querySelectorAll('.variant-item-row');
        variantRows.forEach(tr => {
            const sig = tr.dataset.signature;
            const id = tr.dataset.variantId ? parseInt(tr.dataset.variantId) : null;
            const attrs = JSON.parse(tr.dataset.attributes || '{}');
            const price = parseDecimalPrice(tr.querySelector('.var-price-input').value);
            const stock = parseInt(tr.querySelector('.var-stock-input').value) || 0;
            const sold = parseInt(tr.querySelector('.var-sold-input').value) || 0;
            const images = parseUrls(tr.querySelector('.var-images-input').value);

            const existingIdx = currentVariantsState.findIndex(v => getAttributesSignature(v.attributes) === sig);
            const updatedObj = { id, attributes: attrs, price, stock, sold, images };

            if (existingIdx > -1) {
                currentVariantsState[existingIdx] = updatedObj;
            } else {
                currentVariantsState.push(updatedObj);
            }
        });
    }

    function computeCartesianCombinations(options) {
        if (options.length === 0) return [{}];

        let combinations = [{}];
        options.forEach(opt => {
            const temp = [];
            combinations.forEach(comb => {
                opt.values.forEach(val => {
                    temp.push({ ...comb, [opt.name]: val });
                });
            });
            combinations = temp;
        });

        return combinations;
    }

    function syncVariantsFromProperties() {
        captureCurrentTableInputs();

        const currentBasePrice = parseDecimalPrice(prodPriceInput.value);
        const options = getDefinedOptions();
        const combinations = computeCartesianCombinations(options);

        const previousMap = new Map();
        currentVariantsState.forEach(v => {
            previousMap.set(getAttributesSignature(v.attributes), v);
        });

        const newVariantsList = combinations.map(comb => {
            const sig = getAttributesSignature(comb);
            const prev = previousMap.get(sig);
            return {
                id: prev ? prev.id : null,
                attributes: comb,
                price: prev ? prev.price : currentBasePrice,
                stock: prev ? prev.stock : 0,
                sold: prev ? prev.sold : 0,
                images: prev ? prev.images : []
            };
        });

        currentVariantsState = newVariantsList;
        renderVariantsTable(newVariantsList);
    }

    function renderVariantsTable(variantsList) {
        variantsTbody.innerHTML = '';

        variantsList.forEach(variant => {
            const attrs = variant.attributes || {};
            const keys = Object.keys(attrs);
            const sig = getAttributesSignature(attrs);
            const variantUrls = Array.isArray(variant.images) ? variant.images : [];

            const badgesHtml = keys.length > 0
                ? keys.map(k => `<span class="badge bg-secondary-subtle text-dark border me-1 mb-1">${k}: <strong>${attrs[k]}</strong></span>`).join('')
                : `<span class="badge bg-light text-muted border">Default / Base Product</span>`;

            const previewsHtml = variantUrls.map(u => `
                <img src="${u}" alt="Var" class="rounded-1 border" style="width: 28px; height: 28px; object-fit: cover;" onerror="this.style.display='none'">
            `).join('');

            const tr = document.createElement('tr');
            tr.className = 'variant-item-row';
            tr.dataset.signature = sig;
            tr.dataset.variantId = variant.id || '';
            tr.dataset.attributes = JSON.stringify(attrs);

            tr.innerHTML = `
                <td class="px-3 py-2">${badgesHtml}</td>
                <td class="px-3 py-2">
                    <input type="text" inputmode="decimal" class="form-control form-control-sm simple-input var-price-input" value="${Number(variant.price).toFixed(2)}" required>
                </td>
                <td class="px-3 py-2">
                    <input type="number" min="0" class="form-control form-control-sm simple-input var-stock-input" value="${variant.stock}" required>
                </td>
                <td class="px-3 py-2">
                    <input type="number" min="0" class="form-control form-control-sm simple-input var-sold-input" value="${variant.sold}" required>
                </td>
                <td class="px-3 py-2">
                    <textarea rows="1" class="form-control form-control-sm simple-input var-images-input" placeholder="https://img1.jpg, https://img2.jpg">${variantUrls.join(', ')}</textarea>
                    <div class="d-flex flex-wrap gap-1 mt-1 var-images-preview">${previewsHtml}</div>
                </td>
            `;

            // Actualizar miniaturas de variante al escribir URLs
            const textareaEl = tr.querySelector('.var-images-input');
            const previewBox = tr.querySelector('.var-images-preview');
            textareaEl.addEventListener('input', () => {
                const urls = parseUrls(textareaEl.value);
                previewBox.innerHTML = urls.map(u => `
                    <img src="${u}" alt="Var" class="rounded-1 border" style="width: 28px; height: 28px; object-fit: cover;" onerror="this.style.display='none'">
                `).join('');
            });

            variantsTbody.appendChild(tr);
        });
    }

    // 4. Renderizar tabla principal de productos
    function renderTable() {
        tbody.innerHTML = '';

        if (products.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted-custom">No products found. Add one to get started.</td></tr>`;
            return;
        }

        products.forEach(product => {
            let stockClass = 'stock-good';
            if (product.stock < 5) stockClass = 'stock-critical';
            else if (product.stock < 10) stockClass = 'stock-low';

            const variantsCount = (product.variants || []).length;
            const variantsLabel = variantsCount > 1 ? `${variantsCount} combinations` : 'Single variant';

            const displayCategories = (product.categories && product.categories.length > 0)
                ? product.categories.join(', ')
                : 'All';

            const basePrice = product.originalPrice !== undefined ? product.originalPrice : product.price;
            const totalSold = product.sold || 0;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-4 py-3">
                    <div class="d-flex align-items-center gap-3">
                        <img src="${product.image}" alt="${product.name}" class="product-img-table shadow-sm">
                        <div>
                            <p class="fw-medium text-dark-custom mb-0">${product.name}</p>
                            <p class="small text-muted-custom mb-0">${variantsLabel}</p>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 text-muted-custom">${displayCategories}</td>
                <td class="px-4 py-3 fw-medium text-dark-custom">$${Number(basePrice).toFixed(2)}</td>
                <td class="px-4 py-3">
                    <span class="stock-badge ${stockClass}">${product.stock}</span>
                </td>
                <td class="px-4 py-3 text-muted-custom small">
                    <div><strong>${totalSold}</strong> sold</div>
                    ${product.discount > 0 ? `<span class="badge bg-danger mt-1">-${product.discount}%</span>` : ''}
                </td>
                <td class="px-4 py-3 text-end">
                    <button type="button" class="btn-action edit" onclick="editProduct('${product.id}')" title="Edit">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button type="button" class="btn-action delete" onclick="deleteProduct('${product.id}')" title="Delete">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function toggleForm(show, isEdit = false) {
        if (show) {
            formSection.classList.remove('d-none');
            formTitle.textContent = isEdit ? 'Edit Product' : 'Create New Product';
            if (!isEdit) {
                productForm.reset();
                document.getElementById('product-id').value = '';
                selectedCategories = [];
                updateCategoryButtonLabel();
                propertiesContainer.innerHTML = '';
                baseImagesPreview.innerHTML = '';
                currentVariantsState = [];
                lastKnownBasePrice = 0;
                syncVariantsFromProperties();
            }
        } else {
            formSection.classList.add('d-none');
            productForm.reset();
            document.getElementById('product-id').value = '';
            selectedCategories = [];
            updateCategoryButtonLabel();
            propertiesContainer.innerHTML = '';
            baseImagesPreview.innerHTML = '';
            currentVariantsState = [];
            lastKnownBasePrice = 0;
        }
    }

    toggleFormBtn.addEventListener('click', () => toggleForm(true, false));
    cancelFormBtn.addEventListener('click', () => toggleForm(false));

    // 5. Guardar producto y sus variantes (protegido contra doble clic)
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();

        if (isSubmitting) return;
        isSubmitting = true;

        syncVariantsFromProperties();
        captureCurrentTableInputs();

        const idField = document.getElementById('product-id').value;
        const basePrice = parseDecimalPrice(prodPriceInput.value);
        const baseImages = parseUrls(prodImagesInput.value);
        const definedOptions = getDefinedOptions();

        const payload = {
            id: idField || null,
            name: document.getElementById('prod-name').value.trim(),
            categories: selectedCategories,
            description: document.getElementById('prod-desc').value.trim(),
            price: basePrice,
            images: baseImages,
            options: definedOptions,
            variants: currentVariantsState
        };

        const originalText = saveProductBtn.textContent;
        saveProductBtn.disabled = true;
        saveProductBtn.textContent = 'Saving...';

        try {
            const response = await fetch('../backend/api/products.php', {
                method: idField ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                await fetchProducts();
                toggleForm(false);
            } else {
                alert(result.message || 'Error saving product.');
            }
        } catch (error) {
            console.error('Error guardando producto:', error);
            alert('Server connection error.');
        } finally {
            isSubmitting = false;
            saveProductBtn.disabled = false;
            saveProductBtn.textContent = originalText;
        }
    });

    // 6. Eliminar producto
    window.deleteProduct = async function (id) {
        if (!confirm('Are you sure you want to delete this product?')) return;

        try {
            const response = await fetch(`../backend/api/products.php?id=${encodeURIComponent(id)}`, {
                method: 'DELETE'
            });
            const result = await response.json();

            if (response.ok && result.status === 'success') {
                await fetchProducts();
            } else {
                alert(result.message || 'Could not delete product.');
            }
        } catch (error) {
            console.error('Error eliminando producto:', error);
            alert('Server connection error.');
        }
    };

    // 7. Cargar producto existente en el formulario de edición
    window.editProduct = function (id) {
        const product = products.find(p => p.id === id);
        if (!product) return;

        const basePrice = product.originalPrice !== undefined ? Number(product.originalPrice) : Number(product.price);
        lastKnownBasePrice = basePrice;

        document.getElementById('product-id').value = product.id;
        document.getElementById('prod-name').value = product.name;
        document.getElementById('prod-desc').value = product.description;
        prodPriceInput.value = basePrice.toFixed(2);

        const baseImgs = Array.isArray(product.images) && product.images.length > 0
            ? product.images
            : (product.image ? [product.image] : []);
        prodImagesInput.value = baseImgs.join(', ');
        updateBaseImagesPreview();

        selectedCategories = (product.categories || []).filter(c => c.toLowerCase() !== 'all');
        updateCategoryButtonLabel();

        propertiesContainer.innerHTML = '';
        if (Array.isArray(product.options) && product.options.length > 0) {
            product.options.forEach(opt => {
                addPropertyRow(opt.name || '', Array.isArray(opt.values) ? opt.values.join(', ') : '');
            });
        }

        currentVariantsState = (product.variants || []).map(v => ({
            id: v.id,
            attributes: v.attributes || {},
            price: v.originalPrice !== undefined ? Number(v.originalPrice) : basePrice,
            stock: v.stock || 0,
            sold: v.sold || 0,
            images: Array.isArray(v.images) && v.images.length > 0 ? v.images : (v.image ? [v.image] : [])
        }));

        renderVariantsTable(currentVariantsState.length > 0 ? currentVariantsState : [{
            id: null,
            attributes: {},
            price: basePrice,
            stock: product.stock || 0,
            sold: product.sold || 0,
            images: []
        }]);

        toggleForm(true, true);
        formSection.scrollIntoView({ behavior: 'smooth' });
    };

    fetchProducts();
});