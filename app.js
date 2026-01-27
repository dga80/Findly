let searchResults = { inventario: [], sonepar: [] };
let purchaseList = [];
let selectedFile = null;
let currentInputData = [];

// ... (previous tab and file logic remains same)

// Tab logic
document.getElementById('manualTab').addEventListener('click', () => {
    document.getElementById('manualTab').classList.add('active');
    document.getElementById('uploadTab').classList.remove('active');
    document.getElementById('manualInputContainer').classList.remove('hidden');
    document.getElementById('uploadInputContainer').classList.add('hidden');
});

document.getElementById('uploadTab').addEventListener('click', () => {
    document.getElementById('uploadTab').classList.add('active');
    document.getElementById('manualTab').classList.remove('active');
    document.getElementById('uploadInputContainer').classList.remove('hidden');
    document.getElementById('manualInputContainer').classList.add('hidden');
});

// File upload logic
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileNameSpan = fileInfo.querySelector('.file-name');

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
});

function handleFile(file) {
    selectedFile = file;
    fileNameSpan.textContent = file.name;
    fileInfo.classList.remove('hidden');
}

document.getElementById('clearFile').addEventListener('click', (e) => {
    e.stopPropagation();
    selectedFile = null;
    fileInput.value = '';
    fileInfo.classList.add('hidden');
});

document.getElementById('searchBtn').addEventListener('click', async () => {
    let references = [];
    const isManual = !document.getElementById('manualInputContainer').classList.contains('hidden');

    const btn = document.getElementById('searchBtn');
    btn.textContent = "Procesando...";
    btn.disabled = true;
    document.body.classList.add('loading');

    try {
        if (isManual) {
            const text = document.getElementById('refInput').value;
            const refs = text.split('\n').map(r => r.trim()).filter(r => r !== "");
            if (refs.length === 0) throw new Error("Introduce referencias");
            currentInputData = refs.map(r => ({ reference: r, quantity: 1 }));
            references = refs;
        } else {
            if (!selectedFile) throw new Error("Selecciona un archivo");

            const formData = new FormData();
            formData.append('file', selectedFile);

            const uploadRes = await fetch('http://172.30.0.161:5000/upload', {
                method: 'POST',
                body: formData
            });

            if (!uploadRes.ok) {
                const err = await uploadRes.json();
                throw new Error(err.error || 'Error al subir archivo');
            }

            currentInputData = await uploadRes.json();
            references = currentInputData;
        }

        const response = await fetch('http://172.30.0.161:5000/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ references })
        });

        if (!response.ok) throw new Error('Error en la búsqueda');

        searchResults = await response.json();
        calculatePurchaseList();
        renderTables();

        document.getElementById('exportStockBtn').disabled = (searchResults.inventario.length === 0 && searchResults.sonepar.length === 0);
        document.getElementById('exportPurchaseBtn').disabled = (purchaseList.length === 0);
    } catch (error) {
        console.error(error);
        alert(error.message || "Ocurrió un error.");
    } finally {
        btn.textContent = "Buscar Stock";
        btn.disabled = false;
        document.body.classList.remove('loading');
    }
});

function calculatePurchaseList() {
    purchaseList = [];
    const stockMap = {};

    // 1. Agrupar pedido por referencia (total solicitado)
    const groupedOrder = {};
    currentInputData.forEach(input => {
        const ref = String(input.reference || '').trim().toUpperCase();
        if (!ref) return;
        const qty = parseFloat(input.quantity) || 0;
        groupedOrder[ref] = (groupedOrder[ref] || 0) + qty;
    });

    // 2. Agrupar stock disponible (Sumamos Cerdanya + Sonepar)
    const processStock = (items) => {
        items.forEach(item => {
            const ref = String(item.Referencia || '').trim().toUpperCase();
            if (!ref) return;
            const qty = parseFloat(item.Cantidad) || 0;
            stockMap[ref] = (stockMap[ref] || 0) + qty;
        });
    };

    processStock(searchResults.inventario);
    processStock(searchResults.sonepar);

    // 3. Calcular faltantes
    console.log("Calculando lista de compra...");
    for (const [ref, requested] of Object.entries(groupedOrder)) {
        const available = stockMap[ref] || 0;
        console.log(`Ref: ${ref} | Pedido: ${requested} | Disponible: ${available}`);

        if (available < requested) {
            const toBuy = requested - available;
            purchaseList.push({
                Referencia: ref,
                Pedido: requested,
                Disponible: available,
                'Uds a comprar': toBuy
            });
        }
    }
    console.log("Lista de compra final:", purchaseList);
}

function renderTables() {
    const invTableBody = document.querySelector('#invTable tbody');
    const sonTableBody = document.querySelector('#sonTable tbody');
    const purchaseTableBody = document.querySelector('#purchaseTable tbody');

    const updateHeaders = (tableId) => {
        const thead = document.querySelector(`#${tableId} thead tr`);
        if (!thead.querySelector('.encargo-header')) {
            const th = document.createElement('th');
            th.className = 'encargo-header';
            th.textContent = 'Cant. Encargo';
            thead.appendChild(th);
        }
    };

    updateHeaders('invTable');
    updateHeaders('sonTable');

    invTableBody.innerHTML = searchResults.inventario.map(item => `
        <tr>
            <td>${item.Referencia}</td>
            <td>${item.Ubicacion || '-'}</td>
            <td>${item.Cantidad}</td>
            <td><span class="cant-encargo">${item.CantEncargo || '-'}</span></td>
        </tr>
    `).join('');

    sonTableBody.innerHTML = searchResults.sonepar.map(item => `
        <tr>
            <td>${item.Referencia}</td>
            <td>${item.Empresa || '-'}</td>
            <td>${item.Cantidad}</td>
            <td><span class="cant-encargo">${item.CantEncargo || '-'}</span></td>
        </tr>
    `).join('');

    purchaseTableBody.innerHTML = purchaseList.map(item => `
        <tr>
            <td>${item.Referencia}</td>
            <td style="font-weight:600">${item.Pedido}</td>
            <td style="color:#0369a1; font-weight:700">${item['Uds a comprar']}</td>
        </tr>
    `).join('');

    if (searchResults.inventario.length === 0 && searchResults.sonepar.length === 0 && purchaseList.length === 0) {
        invTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center">No se encontraron resultados</td></tr>';
        sonTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center">No se encontraron resultados</td></tr>';
        purchaseTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center">Todo en stock</td></tr>';
    }
}

document.getElementById('exportStockBtn').addEventListener('click', () => {
    const wb = XLSX.utils.book_new();
    if (searchResults.inventario.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(searchResults.inventario), "Inventario Cerdanya");
    }
    if (searchResults.sonepar.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(searchResults.sonepar), "Stock Sonepar");
    }
    XLSX.writeFile(wb, "Findly_Stock.xlsx");
});

document.getElementById('exportPurchaseBtn').addEventListener('click', () => {
    const wb = XLSX.utils.book_new();
    if (purchaseList.length > 0) {
        // Solo Referencia y Uds a comprar para el listado de compra principal
        const exportData = purchaseList.map(item => ({
            Referencia: item.Referencia,
            'Uds a comprar': item['Uds a comprar']
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportData), "Para Comprar");
    }
    XLSX.writeFile(wb, "Findly_Compra.xlsx");
});
