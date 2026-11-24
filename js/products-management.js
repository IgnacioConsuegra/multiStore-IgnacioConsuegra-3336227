document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('products-tbody');
    const toggleFormBtn = document.getElementById('toggle-form-btn');
    const cancelFormBtn = document.getElementById('cancel-form-btn');
    const formSection = document.getElementById('product-form-section');
    const productForm = document.getElementById('product-form');
    const formTitle = document.getElementById('form-title');

    // Elementos del Dropdown de Categorías
    const categoryDropdownBtn = document.getElementById('category-dropdown-btn');
    const categoryDropdownMenu = document.getElementById('category-dropdown-menu');
    const selectedCategoriesLabel = document.getElementById('selected-categories-label');

    let products = [];
    let selectedCategories = []; // Guarda los nombres de las categorías extra marcadas (sin contar 'All')

    // 1. Cargar productos reales desde MySQL
    async function fetchProducts() {
        try {
            const response = await fetch('../backend/api/products.php');
            if (!response.ok) throw new Error('Error al obtener productos');
            products = await response.json();
            renderTable();
        } catch (error) {
            console.error('Error cargando productos:', error);
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Error loading products from database.</td></tr>`;
        }
    }

    // 2. Buscar categorías en MySQL al tocar el dropdown
    async function loadCategoriesDropdown() {
        categoryDropdownMenu.innerHTML = `<li class="text-muted small py-1"><i class="fa-solid fa-spinner fa-spin me-2"></i>Loading categories...</li>`;

        try {
            const response = await fetch('../backend/api/categories.php');
            if (!response.ok) throw new Error('Error al cargar categorías');

            const categories = await response.json();
            categoryDropdownMenu.innerHTML = '';

            categories.forEach(cat => {
                const isAll = cat.name.toLowerCase() === 'all';
                const isChecked = isAll || selectedCategories.some(c => c.toLowerCase() === cat.name.toLowerCase());

                const li = document.createElement('li');
                li.className = 'mb-2 last-mb-0';
                li.innerHTML = `
                    <label class="d-flex align-items-center gap-2 cursor-pointer user-select-none mb-0">
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

            // Escuchar cambios en las casillas seleccionadas
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

    // Actualiza el texto visible en el botón del dropdown
    function updateCategoryButtonLabel() {
        if (selectedCategories.length === 0) {
            selectedCategoriesLabel.textContent = 'All (Default)';
        } else {
            selectedCategoriesLabel.textContent = `All, ${selectedCategories.join(', ')}`;
        }
    }

    // Disparar consulta a la BD cuando el usuario toca el dropdown de categorías
    if (categoryDropdownBtn) {
        categoryDropdownBtn.addEventListener('click', () => {
            loadCategoriesDropdown();
        });
    }

    // 3. Renderizar tabla de productos
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

            const materialText = product.materials && product.materials.length > 0 ? product.materials[0] : 'N/A';
            const displayCategories = (product.categories && product.categories.length > 0)
                ? product.categories.join(', ')
                : 'All';

            const basePrice = product.originalPrice !== undefined ? product.originalPrice : product.price;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-4 py-3">
                    <div class="d-flex align-items-center gap-3">
                        <img src="${product.image}" alt="${product.name}" class="product-img-table shadow-sm">
                        <div>
                            <p class="fw-medium text-dark-custom mb-0">${product.name}</p>
                            <p class="small text-muted-custom mb-0">${materialText}</p>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 text-muted-custom">${displayCategories}</td>
                <td class="px-4 py-3 fw-medium text-dark-custom">$${Number(basePrice).toFixed(2)}</td>
                <td class="px-4 py-3">
                    <span class="stock-badge ${stockClass}">${product.stock}</span>
                </td>
                <td class="px-4 py-3 text-muted-custom small">
                    ${product.discount > 0 ? `<span class="badge bg-danger">-${product.discount}%</span>` : '<span class="text-muted">No discount</span>'}
                </td>
                <td class="px-4 py-3 text-end">
                    <button class="btn-action edit" onclick="editProduct('${product.id}')" title="Edit">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-action delete" onclick="deleteProduct('${product.id}')" title="Delete">
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
            }
        } else {
            formSection.classList.add('d-none');
            productForm.reset();
            document.getElementById('product-id').value = '';
            selectedCategories = [];
            updateCategoryButtonLabel();
        }
    }

    toggleFormBtn.addEventListener('click', () => toggleForm(true, false));
    cancelFormBtn.addEventListener('click', () => toggleForm(false));

    // 4. Crear o Actualizar producto en MySQL
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const parseArray = (str) => str ? str.split(',').map(item => item.trim()).filter(item => item !== '') : [];
        const idField = document.getElementById('product-id').value;

        const payload = {
            id: idField || null,
            name: document.getElementById('prod-name').value.trim(),
            categories: selectedCategories, // El backend siempre agrega 'All' por defecto
            description: document.getElementById('prod-desc').value.trim(),
            price: parseFloat(document.getElementById('prod-price').value),
            stock: parseInt(document.getElementById('prod-stock').value),
            image: document.getElementById('prod-image').value.trim(),
            sizes: parseArray(document.getElementById('prod-sizes').value),
            colors: parseArray(document.getElementById('prod-colors').value),
            materials: parseArray(document.getElementById('prod-materials').value)
        };

        const submitBtn = productForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

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
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });

    // 5. Eliminar producto en MySQL
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

    // 6. Cargar datos en el formulario para editar
    window.editProduct = function (id) {
        const product = products.find(p => p.id === id);
        if (!product) return;

        document.getElementById('product-id').value = product.id;
        document.getElementById('prod-name').value = product.name;
        document.getElementById('prod-desc').value = product.description;
        // Usar originalPrice para no sobrescribir el precio base con un precio rebajado
        document.getElementById('prod-price').value = product.originalPrice !== undefined ? product.originalPrice : product.price;
        document.getElementById('prod-stock').value = product.stock;
        document.getElementById('prod-image').value = product.image;

        document.getElementById('prod-sizes').value = product.sizes ? product.sizes.join(', ') : '';
        document.getElementById('prod-colors').value = product.colors ? product.colors.join(', ') : '';
        document.getElementById('prod-materials').value = product.materials ? product.materials.join(', ') : '';

        // Cargar categorías actuales del producto (excluyendo 'All' porque va marcada por defecto)
        selectedCategories = (product.categories || []).filter(c => c.toLowerCase() !== 'all');
        updateCategoryButtonLabel();

        toggleForm(true, true);
        formSection.scrollIntoView({ behavior: 'smooth' });
    };

    fetchProducts();
});