document.addEventListener('DOMContentLoaded', () => {
    
    const tbody = document.getElementById('products-tbody');
    const toggleFormBtn = document.getElementById('toggle-form-btn');
    const cancelFormBtn = document.getElementById('cancel-form-btn');
    const formSection = document.getElementById('product-form-section');
    const productForm = document.getElementById('product-form');
    const formTitle = document.getElementById('form-title');

    let products = JSON.parse(localStorage.getItem('currentProducts')) || [];

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
            const rating = product.rating || 0;
            const reviews = product.reviews || 0;

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
                <td class="px-4 py-3 text-muted-custom">${product.category}</td>
                <td class="px-4 py-3 fw-medium text-dark-custom">$${product.price.toFixed(2)}</td>
                <td class="px-4 py-3">
                    <span class="stock-badge ${stockClass}">${product.stock}</span>
                </td>
                <td class="px-4 py-3 text-muted-custom small">
                    <i class="fa-solid fa-star text-warning"></i> ${rating} (${reviews})
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
            if (!isEdit) productForm.reset();
        } else {
            formSection.classList.add('d-none');
            productForm.reset();
            document.getElementById('product-id').value = '';
        }
    }

    toggleFormBtn.addEventListener('click', () => toggleForm(true, false));
    cancelFormBtn.addEventListener('click', () => toggleForm(false));

    productForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const parseArray = (str) => str ? str.split(',').map(item => item.trim()).filter(item => item !== '') : [];

        const idField = document.getElementById('product-id').value;
        const newProduct = {
            id: idField || 'PROD-' + Date.now(),
            name: document.getElementById('prod-name').value.trim(),
            category: document.getElementById('prod-category').value.trim(),
            description: document.getElementById('prod-desc').value.trim(),
            price: parseFloat(document.getElementById('prod-price').value),
            stock: parseInt(document.getElementById('prod-stock').value),
            image: document.getElementById('prod-image').value.trim(),
            sizes: parseArray(document.getElementById('prod-sizes').value),
            colors: parseArray(document.getElementById('prod-colors').value),
            materials: parseArray(document.getElementById('prod-materials').value)
        };

        if (idField) {
            const index = products.findIndex(p => p.id === idField);
            if (index !== -1) {
                newProduct.rating = products[index].rating || 0;
                newProduct.reviews = products[index].reviews || 0;
                products[index] = newProduct;
            }
        } else {
            newProduct.rating = 0;
            newProduct.reviews = 0;
            products.push(newProduct);
        }

        localStorage.setItem('currentProducts', JSON.stringify(products));
        renderTable();
        toggleForm(false);
        alert(idField ? 'Product updated successfully!' : 'Product added successfully!');
    });

    
    window.deleteProduct = function(id) {
        if (confirm('Are you sure you want to delete this product?')) {
            products = products.filter(p => p.id !== id);
            localStorage.setItem('currentProducts', JSON.stringify(products));
            renderTable();
        }
    };

    window.editProduct = function(id) {
        const product = products.find(p => p.id === id);
        if (!product) return;

        document.getElementById('product-id').value = product.id;
        document.getElementById('prod-name').value = product.name;
        document.getElementById('prod-category').value = product.category;
        document.getElementById('prod-desc').value = product.description;
        document.getElementById('prod-price').value = product.price;
        document.getElementById('prod-stock').value = product.stock;
        document.getElementById('prod-image').value = product.image;
        
        document.getElementById('prod-sizes').value = product.sizes ? product.sizes.join(', ') : '';
        document.getElementById('prod-colors').value = product.colors ? product.colors.join(', ') : '';
        document.getElementById('prod-materials').value = product.materials ? product.materials.join(', ') : '';

        toggleForm(true, true);
        formSection.scrollIntoView({ behavior: 'smooth' });
    };

    renderTable();
});