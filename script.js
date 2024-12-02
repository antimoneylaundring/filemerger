document.getElementById('uploadFirstFile').addEventListener('change', handleFileUpload);

let firstFileData = [];
let secondFileData = {};
let mergedData = [];
let handleToBankMap = {};
let ifscToBankMap = {};
let originWebsiteMap = {};
let categoryWebsiteMap = {};

async function loadStaticJson() {
    // Load the static JSON file only once
    const mergeType = document.getElementById('mergeTypeDropdown').value;

    let jsonFilePath = '';
    if (mergeType === 'upi' || mergeType === 'credit_netbanking') {
        jsonFilePath = 'json/secondFile.json'; // JSON for UPI
    } else if (mergeType === 'telegram') {
        jsonFilePath = 'json/telegram_wtsp.json'; // JSON for Telegram
    }

    // Load the selected JSON file
    const selectedJsonFile = await fetch(jsonFilePath);
    secondFileData = await selectedJsonFile.json();

    const handleBankFile = await fetch('json/handleBankName.json');
    const handleFileData = await handleBankFile.json();

    const ifscBankFile = await fetch('json/ifscBankName.json');
    const ifscFileData = await ifscBankFile.json();

    const originWebsite = await fetch('json/originWebsite.json');
    const origin = await originWebsite.json();

    const categoryWebsite = await fetch('json/categoryWebsite.json');
    const category = await categoryWebsite.json();

    // Assuming the handles and bank names are in `Sheet1`
    handleFileData.Sheet2.forEach(item => {
        if (item.Handle && item.Bank_name) {
            handleToBankMap[item.Handle.toLowerCase()] = item.Bank_name;
        }
    });

    ifscFileData.Sheet3.forEach(item => {
        if (item.ifsc_code && item.bank_name) {
            ifscToBankMap[item.ifsc_code] = item.bank_name;
        }
    })

    origin.Sheet1.forEach(item => {
        if (item.url && item.origin) {
            originWebsiteMap[item.url] = item.origin;
        }
    })

    category.Sheet1.forEach(item => {
        if (item.url && item.Category) {
            categoryWebsiteMap[item.url] = item.Category;
        }
    })

    const sheet1Data = secondFileData.Sheet1; // All objects from Sheet1
    const sheet2Data = handleFileData.sheet2; // All objects from sheet2
    const sheet3Data = ifscFileData.sheet3;
    const sheet4Data = origin.sheet1;
    const sheet5Data = category.sheet1;

    secondFileData = { sheet1Data, sheet2Data, sheet3Data, sheet4Data, sheet5Data };

    return secondFileData;
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    firstFileData = XLSX.utils.sheet_to_json(sheet);
}

function extractDomain(url) {
    try {
        const parsedUrl = new URL(url);
        let domain = parsedUrl.hostname;
        domain = domain.replace(/^www\./, '');
        return domain;  // Extracts the domain (without 'https://' or path)
    } catch (e) {
        return 'Invalid URL';  // In case of invalid URL
    }
}

function determineType(upiVpa) {
    const upiVpaStr = String(upiVpa).trim();
    if (!upiVpaStr) return 'Bank Account';

    // Check if it's a UPI ID (contains @)
    if (upiVpaStr.includes('@')) {
        return 'UPI';
    }

    // Check if it's a phone number (basic check for 10 digits)
    const phonePattern = /^\d{10}$/;
    if (phonePattern.test(upiVpaStr)) {
        return 'Wallet';
    }

    return 'Bank Account'; // If neither, return NA
}

function extractTimestampFromUrl(url) {
    // Extract the number from the URL (after 'npci-')
    const match = url.match(/npci-(\d+)--/);
    if (match && match[1]) {
        return parseInt(match[1], 10);  // Convert the matched number to an integer
    }
    return null; // Return null if no number found
}

function convertTimestampToDate(timestamp) {
    if (timestamp) {
        const date = new Date(0); // Start with Unix epoch (1970-01-01)
        date.setSeconds(timestamp); // Add seconds
        // Adjust for your timezone if needed (e.g., GMT+5:30)
        date.setHours(date.getHours() + 5); // Adjust for hours
        date.setMinutes(date.getMinutes() + 30); // Adjust for minutes
        return date.toISOString().slice(0, 10);
    }
    return 'Invalid Timestamp'; // Return this if the timestamp is not valid
}

function determinePlatform(url) {
    if (url.includes('wa')) {
        return 'WhatsApp';
    } else if (url.includes('telegram')) {
        return 'Telegram';
    } else if (url.includes('t.me')) {
        return 'Telegram';
    } else if (url.includes('instagram')) {
        return 'Instagram';
    } else if (url.includes('facebook')) {
        return 'Facebook';
    }
    return 'NA';
}

function convertToDateTime(npciNumber) {
    if (npciNumber) {
        const date = new Date(0); // Start with Unix epoch (1970-01-01)
        date.setSeconds(npciNumber); // Add seconds
        // Adjust for your timezone if needed (e.g., GMT+5:30)
        date.setHours(date.getHours() + 5); // Adjust for hours
        date.setMinutes(date.getMinutes() + 30); // Adjust for minutes
        return date.toISOString().slice(0, 19).replace('T', ' ');
    } // Convert string to number
}

async function previewData() {
    if (firstFileData.length === 0 || secondFileData.length === 0) {
        alert('Please upload the first file and ensure the JSON file is loaded.');
        return;
    }

    await loadStaticJson();

    // Merge each Excel row with the full JSON row structure
    mergedData = firstFileData.map(excelRow => {

        const mergeType = document.getElementById('mergeTypeDropdown').value;

        const npciUrl = excelRow?.npci_url ? excelRow.npci_url : '';
        const mfilteritUrl = npciUrl.replace('npci', 'mfilterit');

        const npci_mfilterit = [mfilteritUrl, npciUrl].filter(Boolean).join(',');

        let bankName = "NA";

        let upiHandle = 'NA';
        let ifscCode = 'NA';

        if (mergeType === 'upi' || mergeType === 'telegram') {
            upiHandle = excelRow?.upi_vpa && String(excelRow.upi_vpa).includes('@')
                ? String(excelRow.upi_vpa).split('@')[1].toLowerCase()
                : 'NA';

            // Extract IFSC code
            ifscCode = excelRow?.ifsc_code && excelRow.ifsc_code !== 'NA'
                ? excelRow.ifsc_code.trim().substring(0, 4).toUpperCase()
                : null;

            // Prioritize IFSC-based bank lookup if IFSC code exists
            if (ifscCode && ifscToBankMap[ifscCode]) {
                bankName = ifscToBankMap[ifscCode];
            }
            // Fallback to UPI handle-based lookup if no valid IFSC code
            else if (upiHandle && handleToBankMap[upiHandle]) {
                bankName = handleToBankMap[upiHandle];
            }
        } else if (mergeType === 'credit_netbanking') {
            bankName = excelRow?.bank_name || '';
        }

        const upiType = mergeType === 'upi' || mergeType === 'telegram'
            ? determineType(excelRow?.upi_vpa || '')
            : mergeType === 'credit_netbanking'
                ? excelRow?.platform?.replace('banking','Banking')
                : 'NA';

        // Extract the timestamp from the URL and convert it to a date
        const timestamp = extractTimestampFromUrl(excelRow?.npci_url); // Adjust the column name as needed
        const date = convertTimestampToDate(timestamp)

        const dateTime = convertToDateTime(timestamp);

        const origin = mergeType === 'upi' || mergeType === 'credit_netbanking' && excelRow?.website_url
            ? originWebsiteMap[excelRow.website_url]
            : 'INDIA';

        const category = mergeType === 'upi' || mergeType === 'credit_netbanking'
            ? (excelRow?.website_url ? categoryWebsiteMap[excelRow.website_url] : 'NA') // UPI ke liye JSON logic
            : excelRow?.category || 'NA';


        const platform = mergeType === 'telegram'
            ? determinePlatform(excelRow?.website_url || '') // Check platform for Telegram
            : mergeType === 'credit_netbanking'
                ? excelRow?.platform
                : 'NA';

        const paymentUrl = mergeType === 'upi'
            ? (excelRow?.payment_gateway_url || '')
            : mergeType === 'credit_netbanking'
                ? (excelRow?.destination_url || '')
                : "NA";


        const upiUrl = mergeType === 'upi'
            ? (excelRow?.payment_gateway_url || '')
            : "NA";

        const intermediateUrl1 = excelRow?.intermediate_url_1 ? excelRow?.intermediate_url_1 : '';
        const intermediateUrl2 = excelRow?.intermediate_url_2 ? excelRow?.intermediate_url_2 : '';
        const intermediateUrl3 = excelRow?.intermediate_url_3 ? excelRow?.intermediate_url_3 : '';
        const intermediateUrl4 = excelRow?.intermediate_url_4 ? excelRow?.intermediate_url_4 : '';

        const intermediateUrls = mergeType === 'upi'
            ? (excelRow?.payment_gateway_url || '')
            : mergeType === 'credit_netbanking'
                ? [intermediateUrl1, intermediateUrl2, intermediateUrl3, intermediateUrl4]
                    .filter(Boolean)
                    .join(',') // Join domains with commas
                : 'NA';

        const intermediateDomainName =
            mergeType === 'credit_netbanking'
                ? [intermediateUrl1, intermediateUrl2, intermediateUrl3, intermediateUrl4]
                    .filter(Boolean) // Remove empty or null values
                    .map(extractDomain) // Extract domain from each URL
                    .join(',') // Join domains with commas
                : '';

        const paymentIntermediateUrls = mergeType === 'upi'
            ? extractDomain(excelRow?.payment_gateway_url || '')
            : mergeType === 'credit_netbanking'
                ? intermediateDomainName
                : 'NA';

        const bankAccountNumber = mergeType === 'upi' || mergeType === 'telegram'
            ? excelRow?.bank_account_number || ''
            : mergeType === 'credit_netbanking'
                ? 'NA'
                : 'NA';

        const ifsc = mergeType === 'upi'
            ? excelRow?.ifsc_code || ''
            : mergeType === 'credit_netbanking'
                ? 'NA'
                : 'NA';

        const upiId = mergeType === 'upi' || mergeType === 'telegram'
            ? excelRow?.upi_vpa || ''
            : mergeType === 'credit_netbanking'
                ? 'NA'
                : 'NA';

        const accHolderName = mergeType === 'upi' || mergeType === 'telegram'
            ? excelRow?.account_holder_name
            : mergeType === "credit_netbanking"
                ? excelRow?.account_holder_name
                    ? excelRow?.account_holder_name
                    : "NA"
                : 'NA';

        return {
            ...secondFileData.sheet1Data[0], // Start with the full JSON structure as the base,
            bank_account_number: bankAccountNumber, // Account Number
            ifsc_code: ifsc, //IFSC Code
            upi_vpa: upiId, // upi id
            ac_holder_name: accHolderName, //account holder name
            website_url: excelRow?.website_url || secondFileData.sheet1Data[0].website_url, //website url
            payment_gateway_intermediate_url: intermediateUrls, //payment gateway url
            payment_gateway_url: paymentUrl, //payment gateway url
            upi_url: upiUrl,
            transaction_method: excelRow?.transaction_method || secondFileData.sheet1Data[0].transaction_method, // Transaction Method
            screenshot: npci_mfilterit,
            screenshot_case_report_link: npci_mfilterit,
            handle: upiHandle,
            payment_gateway_name: paymentIntermediateUrls,
            upi_bank_account_wallet: upiType,
            inserted_date: date,
            case_generated_time: dateTime,
            bank_name: bankName,
            origin: origin,
            category_of_website: category,
            platform: platform
        };
    });

    displayPreview(mergedData);
}

function displayPreview(data) {
    const container = document.getElementById("previewContainer");
    container.innerHTML = "";

    const table = document.createElement("table");
    table.style.borderCollapse = "collapse";
    table.style.width = "100%";

    // Generate table headers
    const headerRow = document.createElement("tr");
    Object.keys(data[0]).forEach(column => {
        const th = document.createElement("th");
        th.textContent = column;
        th.style.border = "1px solid rgb(41 39 68)";
        th.style.padding = "8px 2px";
        th.style.backgroundColor = "#5a5693";
        th.style.color = "#fff";
        th.style.fontSize = "15px"
        th.style.fontWeight = "500"
        th.style.textAlign = "center";
        th.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Populate table rows with data
    data.forEach(row => {
        const rowElement = document.createElement("tr");
        Object.values(row).forEach(cell => {
            const cellElement = document.createElement("td");
            cellElement.textContent = cell || "";  // Show empty if cell is undefined
            cellElement.style.border = "1px solid rgb(41 39 68)";
            cellElement.style.padding = "8px";
            rowElement.appendChild(cellElement);
        });
        table.appendChild(rowElement);
    });

    container.appendChild(table);
}

function downloadUpdatedFile() {
    const ws = XLSX.utils.json_to_sheet(mergedData);
    const csvData = XLSX.utils.sheet_to_csv(ws); // Convert worksheet to CSV format

    // Create a Blob from the CSV data
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });

    // Create a download link
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'MergedFile.csv'; // Set the file name
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
        location.reload(); // Reload the page after a slight delay
    }, 500);
}


// Load the static JSON once when the page loads
loadStaticJson();