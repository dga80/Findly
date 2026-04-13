let searchResults = { inventario: [], sonepar: [], sti: [], addedStock: [] };
let selectedFile = null;
let addedStockFile = null;
let currentInputData = [];
let currentAddedStockData = [];

// Tab logic — "Subir Excel" activo por defecto
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

// Added Stock File upload logic
const addedStockDropZone = document.getElementById('addedStockDropZone');
const addedStockInput = document.getElementById('addedStockInput');
const addedStockInfo = document.getElementById('addedStockInfo');
const addedStockNameSpan = addedStockInfo.querySelector('.file-name');

addedStockDropZone.addEventListener('click', () => addedStockInput.click());

addedStockInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleAddedStockFile(e.target.files[0]);
    }
});

addedStockDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    addedStockDropZone.classList.add('drag-over');
});

addedStockDropZone.addEventListener('dragleave', () => {
    addedStockDropZone.classList.remove('drag-over');
});

addedStockDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    addedStockDropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        handleAddedStockFile(e.dataTransfer.files[0]);
    }
});

function handleAddedStockFile(file) {
    addedStockFile = file;
    addedStockNameSpan.textContent = file.name;
    addedStockInfo.classList.remove('hidden');
}

document.getElementById('clearAddedStock').addEventListener('click', (e) => {
    e.stopPropagation();
    addedStockFile = null;
    addedStockInput.value = '';
    addedStockInfo.classList.add('hidden');
    currentAddedStockData = [];
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

            const uploadRes = await fetch('http://localhost:5000/upload', {
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

        // Subir Stock Dinámico si existe
        if (addedStockFile) {
            const formDataAdded = new FormData();
            formDataAdded.append('file', addedStockFile);
            const uploadAddedRes = await fetch('http://localhost:5000/upload', {
                method: 'POST',
                body: formDataAdded
            });
            if (uploadAddedRes.ok) {
                currentAddedStockData = await uploadAddedRes.json();
            }
        } else {
            currentAddedStockData = [];
        }

        const response = await fetch('http://localhost:5000/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                references,
                addedStock: currentAddedStockData
            })
        });

        if (!response.ok) throw new Error('Error en la búsqueda');

        searchResults = await response.json();
        renderTables();

        const hasResults = (
            (searchResults.inventario && searchResults.inventario.length > 0) ||
            (searchResults.sonepar && searchResults.sonepar.length > 0) ||
            (searchResults.sti && searchResults.sti.length > 0)
        );

        document.getElementById('exportStockBtn').disabled = !hasResults;
        document.getElementById('exportPdfBtn').disabled = !hasResults;

    } catch (error) {
        console.error(error);
        alert(error.message || "Ocurrió un error.");
    } finally {
        btn.textContent = "Buscar Stock";
        btn.disabled = false;
        document.body.classList.remove('loading');
    }
});

function renderTables() {
    const invTableBody = document.querySelector('#invTable tbody');
    const sonTableBody = document.querySelector('#sonTable tbody');
    const stiTableBody = document.querySelector('#stiTable tbody');

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
    updateHeaders('dynamicTable');

    // Identificar referencias duplicadas en los listados
    const invRefs = new Set(searchResults.inventario.map(item => String(item.Referencia).trim().toUpperCase()));
    const sonRefs = new Set(searchResults.sonepar.map(item => String(item.Referencia).trim().toUpperCase()));
    const stiRefs = new Set((searchResults.sti || []).map(r => String(r).trim().toUpperCase()));
    const addedRefs = new Set((searchResults.addedStock || []).map(item => String(item.Referencia).trim().toUpperCase()));

    // Coincidencias entre Cerdanya y Sonepar (para sus tablas correspondientes)
    const commonCerSon = new Set([...invRefs].filter(ref => sonRefs.has(ref)));
    // Coincidencias para STI/Dinámico (si están en alguno de los anteriores)
    const commonOther = new Set([...new Set([...stiRefs, ...addedRefs])].filter(ref => invRefs.has(ref) || sonRefs.has(ref)));

    // Renderizar Inventario Cerdanya
    invTableBody.innerHTML = searchResults.inventario.length > 0
        ? searchResults.inventario.map(item => {
            const isRepeat = commonCerSon.has(String(item.Referencia).trim().toUpperCase());
            return `
                <tr>
                    <td>${item.Referencia}</td>
                    <td>${item.Ubicacion || '-'}</td>
                    <td><span class="${isRepeat ? 'common-stock-badge' : ''}">${item.Cantidad}</span></td>
                    <td><span class="cant-encargo">${item.CantEncargo || '-'}</span></td>
                </tr>
            `;
        }).join('')
        : '<tr><td colspan="4" style="text-align:center">No se encontraron resultados</td></tr>';

    // Renderizar Stock Sonepar
    sonTableBody.innerHTML = searchResults.sonepar.length > 0
        ? searchResults.sonepar.map(item => {
            const isRepeat = commonCerSon.has(String(item.Referencia).trim().toUpperCase());
            return `
                <tr>
                    <td>${item.Referencia}</td>
                    <td>${item.Empresa || '-'}</td>
                    <td><span class="${isRepeat ? 'common-stock-badge' : ''}">${item.Cantidad}</span></td>
                    <td><span class="cant-encargo">${item.CantEncargo || '-'}</span></td>
                </tr>
            `;
        }).join('')
        : '<tr><td colspan="4" style="text-align:center">No se encontraron resultados</td></tr>';

    // Renderizar Stock STI
    // searchResults.sti es una lista de referencias que coinciden en el archivo ZOE STI
    const stiSet = new Set((searchResults.sti || []).map(r => String(r).trim().toUpperCase()));

    // Construir la lista a partir de todas las referencias buscadas
    const allRefs = [...new Set(currentInputData.map(item =>
        String(item.reference || item).trim()
    ))];

    const stiRows = allRefs.filter(ref => stiSet.has(ref.toUpperCase()));

    stiTableBody.innerHTML = stiRows.length > 0
        ? stiRows.map(ref => {
            const isRepeat = commonOther.has(String(ref).trim().toUpperCase());
            return `
                <tr>
                    <td><span class="${isRepeat ? 'common-stock-badge' : ''}">${ref}</span></td>
                    <td><span class="sti-badge">✔ Disponible</span></td>
                </tr>
            `;
        }).join('')
        : '<tr><td colspan="2" style="text-align:center">Sin coincidencias en STI</td></tr>';

    // Renderizar Stock Dinámico
    const dynamicTableBody = document.querySelector('#dynamicTable tbody');
    dynamicTableBody.innerHTML = searchResults.addedStock.length > 0
        ? searchResults.addedStock.map(item => {
            const isRepeat = commonOther.has(String(item.Referencia).trim().toUpperCase());
            return `
                <tr>
                    <td><span class="${isRepeat ? 'common-stock-badge' : ''}">${item.Referencia}</span></td>
                    <td><span class="${isRepeat ? 'common-stock-badge' : ''}">${item.Cantidad}</span></td>
                    <td><span class="cant-encargo">${item.CantEncargo || '-'}</span></td>
                </tr>
            `;
        }).join('')
        : '<tr><td colspan="3" style="text-align:center">Sin coincidencias en Stock Dinámico</td></tr>';
}

document.getElementById('exportStockBtn').addEventListener('click', () => {
    const wb = XLSX.utils.book_new();
    if (searchResults.inventario.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(searchResults.inventario), "Inventario Cerdanya");
    }
    if (searchResults.sonepar.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(searchResults.sonepar), "Stock Sonepar");
    }
    if ((searchResults.sti || []).length > 0) {
        const stiExport = searchResults.sti.map(ref => ({ Referencia: ref, 'En STI': 'Sí' }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stiExport), "Stock STI");
    }
    if (searchResults.addedStock.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(searchResults.addedStock), "Stock Dinámico");
    }

    let fileName = "Findly_Stock.xlsx";
    if (selectedFile) {
        const baseName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.'));
        fileName = `${baseName} STOCK.xlsx`;
    }
    XLSX.writeFile(wb, fileName);
});

document.getElementById('exportPdfBtn').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Paisaje
    const pageWidth = doc.internal.pageSize.getWidth();
    
    const primaryColor = [30, 41, 59];
    const accentColor = [37, 99, 235];
    const highlightColor = [224, 231, 255];
    const highlightTextColor = [30, 58, 138];

    // Coincidencias entre Cerdanya y Sonepar
    const invRefsSet = new Set(searchResults.inventario.map(item => String(item.Referencia).trim().toUpperCase()));
    const sonRefsSet = new Set(searchResults.sonepar.map(item => String(item.Referencia).trim().toUpperCase()));
    const stiRefsSet = new Set((searchResults.sti || []).map(r => String(r).trim().toUpperCase()));
    const addedRefsSet = new Set(searchResults.addedStock.map(item => String(item.Referencia).trim().toUpperCase()));
    
    const commonCerSon = new Set([...invRefsSet].filter(ref => sonRefsSet.has(ref)));
    const commonWithOther = new Set([...new Set([...stiRefsSet, ...addedRefsSet])].filter(ref => invRefsSet.has(ref) || sonRefsSet.has(ref)));

    // Cabecera: Título con nombre de archivo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...primaryColor);
    let titleName = selectedFile ? selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) : "Manual";
    doc.text(`${titleName} / Informe de Stock`, 10, 15);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    const dateStr = new Date().toLocaleString('es-ES', { 
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    doc.text(`Generado: ${dateStr}`, 10, 20);
    
    doc.setDrawColor(...accentColor);
    doc.setLineWidth(0.4);
    doc.line(10, 23, pageWidth - 10, 23);

    // Leyenda
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...highlightTextColor);
    doc.text("* Filas en azul: En Cerdanya y Sonepar (o STI/Dinámico presente).", 10, 28);

    // --- CONFIGURACIÓN DE 4 COLUMNAS SIDE-BY-SIDE ---
    const startY = 32;
    const paddingX = 10;
    const colWidth = 65; // Reducido para 4 columnas
    const gap = 4;

    // Tabla 1: Cerdanya
    doc.setFontSize(11);
    doc.setTextColor(...accentColor);
    doc.text("Inventario Cerdanya", paddingX, startY + 5);

    doc.autoTable({
        startY: startY + 8,
        margin: { left: paddingX },
        tableWidth: colWidth,
        head: [['Ref', 'Ubic', 'Cant', 'Enc', 'Obs']],
        body: searchResults.inventario.map(item => [
            item.Referencia, 
            item.Ubicacion || '-', 
            item.Cantidad, 
            item.CantEncargo || '-',
            ''
        ]),
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 7, cellPadding: 1 },
        styles: { fontSize: 6.5, cellPadding: 0.8 },
        columnStyles: {
            0: { cellWidth: 22 }, // Ref
            1: { cellWidth: 10 }, // Ubic
            2: { cellWidth: 8, halign: 'center' }, // Cant
            3: { cellWidth: 8, halign: 'center' }, // Enc
            4: { cellWidth: 17 }  // Obs
        },
        didParseCell: (data) => {
            if (data.section === 'body' && data.row.raw) {
                const ref = String(data.row.raw[0]).trim().toUpperCase();
                if (commonCerSon.has(ref)) {
                    data.cell.styles.fillColor = highlightColor;
                    data.cell.styles.textColor = highlightTextColor;
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    // Tabla 2: Sonepar (Misma posición Y)
    const soneparX = paddingX + colWidth + gap;
    doc.setFontSize(11);
    doc.setTextColor(...accentColor);
    doc.text("Stock Sonepar", soneparX, startY + 5);

    doc.autoTable({
        startY: startY + 8,
        margin: { left: soneparX },
        tableWidth: colWidth,
        head: [['Ref', 'Empresa', 'Cant', 'Enc', 'Obs']],
        body: searchResults.sonepar.map(item => [
            item.Referencia, 
            item.Empresa || '-', 
            item.Cantidad, 
            item.CantEncargo || '-',
            ''
        ]),
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 7, cellPadding: 1 },
        styles: { fontSize: 6.5, cellPadding: 0.8 },
        columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 10 },
            2: { cellWidth: 8, halign: 'center' },
            3: { cellWidth: 8, halign: 'center' },
            4: { cellWidth: 17 }
        },
        didParseCell: (data) => {
            if (data.section === 'body' && data.row.raw) {
                const ref = String(data.row.raw[0]).trim().toUpperCase();
                if (commonCerSon.has(ref)) {
                    data.cell.styles.fillColor = highlightColor;
                    data.cell.styles.textColor = highlightTextColor;
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    // Tabla 3: STI (Misma posición Y)
    const stiX = soneparX + colWidth + gap;
    doc.setFontSize(11);
    doc.setTextColor(21, 128, 61);
    doc.text("Stock STI", stiX, startY + 5);

    doc.autoTable({
        startY: startY + 8,
        margin: { left: stiX },
        tableWidth: 30, // Reducido
        head: [['Ref']],
        body: (searchResults.sti || []).map(ref => [ref]),
        theme: 'grid',
        headStyles: { fillColor: [21, 128, 61], textColor: 255, fontSize: 7, cellPadding: 1 },
        styles: { fontSize: 6.5, cellPadding: 0.8 },
        didParseCell: (data) => {
            if (data.section === 'body' && data.row.raw) {
                const ref = String(data.row.raw[0]).trim().toUpperCase();
                if (commonWithOther.has(ref)) {
                    data.cell.styles.fillColor = highlightColor;
                    data.cell.styles.textColor = highlightTextColor;
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    // Tabla 4: STOCK DINÁMICO
    const dynamicX = stiX + 30 + gap;
    doc.setFontSize(11);
    doc.setTextColor(3, 105, 161);
    doc.text("Stock Dinámico", dynamicX, startY + 5);

    doc.autoTable({
        startY: startY + 8,
        margin: { left: dynamicX },
        tableWidth: colWidth,
        head: [['Ref', 'Cant', 'Enc', 'Obs']],
        body: searchResults.addedStock.map(item => [
            item.Referencia, 
            item.Cantidad, 
            item.CantEncargo || '-',
            ''
        ]),
        theme: 'grid',
        headStyles: { fillColor: [3, 105, 161], textColor: 255, fontSize: 7, cellPadding: 1 },
        styles: { fontSize: 6.5, cellPadding: 0.8 },
        columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 10, halign: 'center' },
            2: { cellWidth: 10, halign: 'center' },
            3: { cellWidth: 20 }
        },
        didParseCell: (data) => {
            if (data.section === 'body' && data.row.raw) {
                const ref = String(data.row.raw[0]).trim().toUpperCase();
                if (commonWithOther.has(ref)) {
                    data.cell.styles.fillColor = highlightColor;
                    data.cell.styles.textColor = highlightTextColor;
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    let fileName = selectedFile 
        ? `${selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.'))}_STOCK.pdf` 
        : "Informe_Stock.pdf";
    doc.save(fileName);
});
