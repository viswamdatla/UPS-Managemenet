// Google Sheets API Configuration
const GOOGLE_SHEETS_CONFIG = {
    apiKey: 'AIzaSyARUcWQDXIFnYWpcIQDs-sH97bvPSmFg4o', // Replace with your Google Cloud API key
    spreadsheetId: '1TFjR4FcM4zcx2g1avGINxcwZMMb7eEvnun7BU_o6Hlk', // Replace with your Google Sheet ID
    range: 'Form Responses 1!B:H', // Columns: TIMESTAMP (B), MACHINE NUMBER (C), VOLTAGE (D), CURRENT (E), LOAD (F), RUNTIME (G), IMAGE (H)
};

// Device data storage (fallback values)
let devicesData = {
    'UPS-DC-001': { model: 'APC Smart-UPS', spec: '10kVA', voltage: '230V', current: '43.5A', load: '62%', runtime: '45m', image: '' },
    'UPS-DC-002': { model: 'Eaton 9PX', spec: '6kVA', voltage: '230V', current: '26.1A', load: '85%', runtime: '18m', image: '' },
    'UPS-DC-003': { model: 'Vertiv Liebert', spec: 'GXT5', voltage: '230V', current: '22.8A', load: '45%', runtime: '67m', image: '' },
    'UPS-DC-004': { model: 'Schneider Galaxy', spec: 'VS', voltage: '230V', current: '15.2A', load: '78%', runtime: '8m', image: '' },
    'UPS-DC-005': { model: 'APC Smart-UPS', spec: '8kVA', voltage: '230V', current: '34.8A', load: '55%', runtime: '52m', image: '' },
    'UPS-DC-006': { model: 'Eaton 9PX', spec: '5kVA', voltage: '230V', current: '21.7A', load: '70%', runtime: '35m', image: '' }
};

// Store all historical data with timestamps
let allHistoricalData = [];

// Fetch data from Google Sheets
async function fetchGoogleSheetsData() {
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_CONFIG.spreadsheetId}/values/${GOOGLE_SHEETS_CONFIG.range}?key=${GOOGLE_SHEETS_CONFIG.apiKey}`;
        
        console.log('Attempting to fetch from:', url);
        
        const response = await fetch(url);
        
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`Failed to fetch data from Google Sheets: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Received data:', data);
        const rows = data.values;
        
        if (rows && rows.length > 0) {
            console.log('Processing', rows.length, 'rows');
            
            // Reset historical data
            allHistoricalData = [];
            
            // Create a temporary map to store only the latest data for each device
            const latestData = {};
            
            // Parse the data from Google Sheets
            // Columns: TIMESTAMP (B), MACHINE NUMBER (C), VOLTAGE (D), CURRENT (E), LOAD (F), RUNTIME (G), IMAGE (H)
            // Skip the first row (headers) and process all rows
            rows.slice(1).forEach((row, index) => {
                const timestamp = row[0]?.trim();  // TIMESTAMP (Column B)
                const deviceId = row[1]?.trim();   // MACHINE NUMBER (Column C)
                const voltage = row[2]?.trim();    // VOLTAGE (Column D)
                const current = row[3]?.trim();    // CURRENT (Column E)
                const load = row[4]?.trim();       // LOAD (Column F)
                const runtime = row[5]?.trim();    // RUNTIME (Column G)
                const image = row[6]?.trim();      // IMAGE (Column H)
                
                // Store all data with timestamps for date-filtered reports
                if (deviceId && timestamp) {
                    allHistoricalData.push({
                        timestamp: timestamp,
                        deviceId: deviceId,
                        voltage: voltage,
                        current: current,
                        load: load,
                        runtime: runtime,
                        image: image
                    });
                }
                
                // Store the latest entry for each device (later rows overwrite earlier ones)
                if (deviceId) {
                    latestData[deviceId] = {
                        voltage: voltage,
                        current: current,
                        load: load,
                        runtime: runtime,
                        image: image,
                        rowIndex: index + 2 // +2 because we skipped header and arrays are 0-indexed
                    };
                }
            });
            
            console.log('Latest data for each device:', latestData);
            console.log('All historical data:', allHistoricalData);
            
            // Now update devicesData with the latest values
            Object.keys(latestData).forEach(deviceId => {
                const data = latestData[deviceId];
                
                console.log(`Updating device: ${deviceId} (from row ${data.rowIndex})`, data);
                
                // Update device data if device ID exists
                if (devicesData[deviceId]) {
                    if (data.voltage) devicesData[deviceId].voltage = data.voltage.includes('V') ? data.voltage : data.voltage + 'V';
                    if (data.current) devicesData[deviceId].current = data.current.includes('A') ? data.current : data.current + 'A';
                    if (data.load) devicesData[deviceId].load = data.load.includes('%') ? data.load : data.load + '%';
                    if (data.runtime) devicesData[deviceId].runtime = /m$|min$|h$|hr$|hour|hours/i.test(data.runtime) ? data.runtime : data.runtime + 'm';
                    if (data.image) devicesData[deviceId].image = data.image;
                }
            });
            
            console.log('Final devicesData:', devicesData);
            
            // Update the table with new data
            updateDevicesTable();
            // Update dashboard cards with new data
            updateDashboardCards();
            console.log('✅ Data updated from Google Sheets successfully!');
            return Promise.resolve();
        } else {
            console.warn('No data rows found in the sheet');
            return Promise.resolve();
        }
    } catch (error) {
        console.error('❌ Error fetching Google Sheets data:', error);
        console.log('Using last known values...');
        return Promise.reject(error);
    }
}

// Update the devices table with current data
function updateDevicesTable() {
    // Get all device ID cells
    const deviceCells = document.querySelectorAll('td.device-id');
    
    deviceCells.forEach(cell => {
        const deviceId = cell.textContent.trim();
        const device = devicesData[deviceId];
        
        if (device) {
            const parentRow = cell.closest('tr');
            
            // Update voltage
            const voltageCell = parentRow.querySelector('td:nth-child(3) .metric-value');
            if (voltageCell) voltageCell.textContent = device.voltage;
            
            // Update current
            const currentCell = parentRow.querySelector('td:nth-child(4) .metric-value');
            if (currentCell) currentCell.textContent = device.current;
            
            // Update load
            const loadCell = parentRow.querySelector('td:nth-child(5) .metric-value');
            if (loadCell) loadCell.textContent = device.load;
            
            // Update runtime
            const runtimeCell = parentRow.querySelector('td:nth-child(6) .metric-value');
            if (runtimeCell) runtimeCell.textContent = device.runtime;
        }
    });
}

// Update dashboard device cards with current data
function updateDashboardCards() {
    Object.keys(devicesData).forEach(deviceId => {
        const device = devicesData[deviceId];
        
        // Find the card by searching for h3 with device ID
        const cards = document.querySelectorAll('.device-card');
        cards.forEach(card => {
            const cardTitle = card.querySelector('.device-card-header h3');
            if (cardTitle && cardTitle.textContent.trim() === deviceId) {
                // Update voltage
                const voltageValue = card.querySelector('.metric-row:nth-child(1) .metric-value-large');
                if (voltageValue && device.voltage) {
                    voltageValue.textContent = device.voltage;
                }
                
                // Update load
                const loadValue = card.querySelector('.metric-row:nth-child(2) .metric-value-large');
                if (loadValue && device.load) {
                    loadValue.textContent = device.load;
                }
                
                // Update current
                const currentValue = card.querySelector('.footer-metric:nth-child(1) .footer-value');
                if (currentValue && device.current) {
                    currentValue.textContent = device.current;
                }
                
                // Update runtime
                const runtimeValue = card.querySelector('.footer-metric:nth-child(2) .footer-value');
                if (runtimeValue && device.runtime) {
                    runtimeValue.textContent = device.runtime;
                }
            }
        });
    });
}

// Helper function for querySelector with text content
document.querySelectorAll('td.device-id').forEach(td => {
    const deviceId = td.textContent.trim();
    td.setAttribute('data-device-id', deviceId);
});

// Add interactivity to navigation items
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        this.classList.add('active');
        
        // Handle page navigation - get the text from the span, not the icon
        const spans = this.querySelectorAll('span');
        const pageName = spans[1] ? spans[1].textContent.trim() : this.textContent.trim();
        
        console.log('Navigating to:', pageName);
        
        // Hide all pages
        const dashboardPage = document.getElementById('dashboardPage');
        const upsDevicesPage = document.getElementById('upsDevicesPage');
        const reportsPage = document.getElementById('reportsPage');
        const settingsPage = document.getElementById('settingsPage');
        
        console.log('Dashboard page element:', dashboardPage);
        console.log('UPS Devices page element:', upsDevicesPage);
        console.log('Reports page element:', reportsPage);
        console.log('Settings page element:', settingsPage);
        
        if (dashboardPage) dashboardPage.style.display = 'none';
        if (upsDevicesPage) upsDevicesPage.style.display = 'none';
        if (reportsPage) reportsPage.style.display = 'none';
        if (settingsPage) settingsPage.style.display = 'none';
        
        // Show selected page
        if (pageName === 'Dashboard') {
            if (dashboardPage) {
                dashboardPage.style.display = 'block';
                console.log('Showing Dashboard');
                // Fetch latest data when Dashboard is opened
                fetchGoogleSheetsData();
            }
        } else if (pageName === 'UPS Devices') {
            if (upsDevicesPage) {
                upsDevicesPage.style.display = 'block';
                console.log('Showing UPS Devices');
                // Fetch latest data when UPS Devices page is opened
                fetchGoogleSheetsData();
            }
        } else if (pageName === 'Reports') {
            if (reportsPage) {
                reportsPage.style.display = 'block';
                console.log('Showing Reports');
                // Fetch latest data when Reports page is opened
                fetchGoogleSheetsData();
            }
        } else if (pageName === 'Settings') {
            if (settingsPage) {
                settingsPage.style.display = 'block';
                console.log('Showing Settings');
            }
        } else {
            // For other pages, show dashboard for now
            if (dashboardPage) dashboardPage.style.display = 'block';
            alert(`${pageName} page - Coming soon!`);
        }
    });
});

// Add click animation to stat cards
document.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('click', function() {
        this.style.transform = 'scale(0.98)';
        setTimeout(() => {
            this.style.transform = 'translateY(-2px)';
        }, 100);
    });
});

// Simulate real-time updates for stats
function updateStats() {
    const powerValue = document.querySelector('.stat-card:nth-child(2) .stat-value');
    if (powerValue) {
        const currentValue = parseFloat(powerValue.textContent);
        const newValue = (currentValue + (Math.random() - 0.5) * 0.1).toFixed(1);
        powerValue.innerHTML = `${newValue} <span class="unit">MW</span>`;
    }
}

// Update stats every 5 seconds
setInterval(updateStats, 5000);

// Fetch Google Sheets data every 30 seconds to keep data fresh
setInterval(fetchGoogleSheetsData, 30000);

// Initial fetch on page load
window.addEventListener('load', () => {
    fetchGoogleSheetsData();
});

// Add notification click handler
document.querySelector('.notification').addEventListener('click', function() {
    alert('You have 1 critical alert: Battery Low on UPS-HQ-001');
});

// Add user profile click handler
document.querySelector('.user-profile').addEventListener('click', function() {
    alert('User Profile: Admin User (Enterprise)');
});

// Report generation function
function generateReport() {
    const deviceIdRaw = document.getElementById('reportType').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const format = document.querySelector('input[name="format"]:checked').value;
    
    // First fetch the latest data from Google Sheets, then generate report
    console.log('Fetching latest data before generating report...');
    
    fetchGoogleSheetsData().then(() => {
        // Convert device ID to uppercase to match devicesData keys
        const deviceId = deviceIdRaw === 'all-devices' ? 'all-devices' : deviceIdRaw.toUpperCase();
        
        console.log('Selected device ID:', deviceId);
        console.log('Date range:', startDate, 'to', endDate);
        console.log('All historical data:', allHistoricalData);
        
        // Filter data based on date range
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999); // Include entire end date
        
        console.log('Filtering between:', startDateObj, 'and', endDateObj);
        
        let filteredData = allHistoricalData.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            const matchesDate = entryDate >= startDateObj && entryDate <= endDateObj;
            const matchesDevice = deviceId === 'all-devices' || entry.deviceId === deviceId;
            
            console.log(`Entry ${entry.deviceId} at ${entry.timestamp}:`, 
                        `Date Match: ${matchesDate}, Device Match: ${matchesDevice}`);
            
            return matchesDate && matchesDevice;
        });
        
        console.log('Filtered data:', filteredData);
        
        if (filteredData.length === 0) {
            alert(`No data found for ${deviceId === 'all-devices' ? 'any device' : deviceId} between ${startDate} and ${endDate}.`);
            return;
        }
        
        // Generate report content
        const reportData = {
            title: `UPS Device Report - ${deviceId === 'all-devices' ? 'All Devices' : deviceId}`,
            generatedDate: new Date().toLocaleString(),
            dateRange: `${startDate} to ${endDate}`,
            deviceId: deviceId === 'all-devices' ? 'All Devices' : deviceId,
            data: filteredData.map(entry => ({
                timestamp: entry.timestamp,
                id: entry.deviceId,
                voltage: entry.voltage,
                current: entry.current,
                load: entry.load,
                runtime: entry.runtime
            }))
        };
        
        console.log('Generating report with filtered data:', reportData);
        
        if (format === 'csv') {
            downloadCSVReport(reportData);
        } else if (format === 'excel') {
            downloadExcelReport(reportData);
        } else {
            downloadPDFReport(reportData);
        }
    }).catch(error => {
        console.error('Error fetching data:', error);
        alert('Error loading data from Google Sheets. Please check your connection and try again.');
    });
}

// Download CSV Report
function downloadCSVReport(reportData) {
    let csv = `UPS Device Report - ${reportData.deviceId}\n`;
    csv += `Generated: ${reportData.generatedDate}\n`;
    csv += `Date Range: ${reportData.dateRange}\n\n`;
    csv += `Timestamp,Device ID,Voltage,Current,Load,Runtime\n`;
    
    reportData.data.forEach(device => {
        csv += `${device.timestamp || 'N/A'},${device.id},${device.voltage || 'N/A'},${device.current || 'N/A'},${device.load || 'N/A'},${device.runtime || 'N/A'}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UPS_Report_${reportData.deviceId}_${new Date().getTime()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    alert('CSV report downloaded successfully!');
}

// Download Excel Report (as CSV with .xls extension for simplicity)
function downloadExcelReport(reportData) {
    let content = `UPS Device Report - ${reportData.deviceId}\n`;
    content += `Generated: ${reportData.generatedDate}\n`;
    content += `Date Range: ${reportData.dateRange}\n\n`;
    content += `Timestamp\tDevice ID\tVoltage\tCurrent\tLoad\tRuntime\n`;
    
    reportData.data.forEach(device => {
        content += `${device.timestamp || 'N/A'}\t${device.id}\t${device.voltage || 'N/A'}\t${device.current || 'N/A'}\t${device.load || 'N/A'}\t${device.runtime || 'N/A'}\n`;
    });
    
    const blob = new Blob([content], { type: 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UPS_Report_${reportData.deviceId}_${new Date().getTime()}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    alert('Excel report downloaded successfully!');
}

// Download PDF Report
function downloadPDFReport(reportData) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.setTextColor(30, 64, 175);
    doc.text(reportData.title, 14, 22);
    
    // Add metadata
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Generated: ${reportData.generatedDate}`, 14, 32);
    doc.text(`Date Range: ${reportData.dateRange}`, 14, 38);
    
    // Prepare table data
    const tableData = reportData.data.map(device => [
        device.timestamp || 'N/A',
        device.id,
        device.voltage || 'N/A',
        device.current || 'N/A',
        device.load || 'N/A',
        device.runtime || 'N/A'
    ]);
    
    // Add table
    doc.autoTable({
        startY: 45,
        head: [['Timestamp', 'Device ID', 'Voltage', 'Current', 'Load', 'Runtime']],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [30, 64, 175],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
        },
        styles: {
            fontSize: 9,
            cellPadding: 3
        },
        columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 25 }
        }
    });
    
    // Add footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.text(
            `PowerGuard UPS Management System - Page ${i} of ${pageCount}`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
        );
    }
    
    // Download the PDF
    doc.save(`UPS_Report_${reportData.deviceId}_${new Date().getTime()}.pdf`);
    
    alert('PDF report downloaded successfully!');
}

// Download report function (for recent reports)
function downloadReport(reportId) {
    alert(`Downloading report: ${reportId}\nNote: This is a demo. Actual reports would be stored on a server.`);
}

// View device image function
function viewImage(deviceId) {
    const device = devicesData[deviceId];
    const modal = document.getElementById('imageModal');
    const modalTitle = document.getElementById('imageModalTitle');
    const modalImg = document.getElementById('imageModalImg');
    const modalIframe = document.getElementById('imageModalIframe');
    const modalNoImage = document.getElementById('imageModalNoImage');
    
    modalTitle.textContent = `${deviceId} - Device Image`;
    
    if (device && device.image) {
        // Convert Google Drive URL to embeddable format
        let imageUrl = device.image;
        let embedUrl = device.image;
        
        // Check if it's a Google Drive link
        if (imageUrl.includes('drive.google.com')) {
            // Extract file ID from various Google Drive URL formats
            let fileId = null;
            
            // Format: https://drive.google.com/open?id=FILE_ID
            if (imageUrl.includes('open?id=')) {
                fileId = imageUrl.split('open?id=')[1].split('&')[0];
            }
            // Format: https://drive.google.com/file/d/FILE_ID/view
            else if (imageUrl.includes('/file/d/')) {
                fileId = imageUrl.split('/file/d/')[1].split('/')[0];
            }
            // Format: https://drive.google.com/uc?id=FILE_ID
            else if (imageUrl.includes('uc?id=')) {
                fileId = imageUrl.split('uc?id=')[1].split('&')[0];
            }
            
            // Convert to embeddable URL
            if (fileId) {
                imageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
                embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
            }
        }
        
        // Show loading state
        modalImg.style.display = 'none';
        modalIframe.style.display = 'none';
        modalNoImage.textContent = 'Loading image...';
        modalNoImage.style.display = 'block';
        
        // Try to load the image first
        const testImg = new Image();
        testImg.onload = function() {
            modalImg.src = imageUrl;
            modalImg.style.display = 'block';
            modalIframe.style.display = 'none';
            modalNoImage.style.display = 'none';
        };
        testImg.onerror = function() {
            // If direct image fails, use iframe to embed Google Drive viewer
            modalImg.style.display = 'none';
            modalIframe.src = embedUrl;
            modalIframe.style.display = 'block';
            modalNoImage.style.display = 'none';
            console.log('Using iframe for Google Drive image:', embedUrl);
        };
        testImg.src = imageUrl;
    } else {
        modalImg.style.display = 'none';
        modalIframe.style.display = 'none';
        modalNoImage.textContent = 'No image available for this device';
        modalNoImage.style.display = 'block';
    }
    
    modal.classList.add('active');
}

// Close image modal
function closeImageModal() {
    const modal = document.getElementById('imageModal');
    const modalIframe = document.getElementById('imageModalIframe');
    modal.classList.remove('active');
    // Clear iframe to stop loading
    modalIframe.src = '';
}

// Settings page functions
function saveUserProfile() {
    alert('User profile saved successfully!');
}

function saveSystemPreferences() {
    alert('System preferences saved successfully!');
}

function saveAlertThresholds() {
    alert('Alert thresholds saved successfully!');
}

function saveDataSettings() {
    alert('Data settings saved successfully!');
}

console.log('PowerGuard Dashboard initialized successfully!');
