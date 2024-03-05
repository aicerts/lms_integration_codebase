// Import necessary modules and functions
const calculateHash = require("../../calculateHash");
const web3i = require("../../web3i");
const confirm = require("../../confirm");
const QRCode = require("qrcode");
const { decryptData, generateEncryptedUrl } = require("../../common/cryptoFunction");
const moment = require('moment');


/**
 * Handles the issuance of a certificate.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const issueCertificate = async (req, res) => {
    try {
        // Extract certificate information from the request body
        const Certificate_Number = req.body.Certificate_Number;
        const name = req.body.name;
        const courseName = req.body.courseName;
        const Grant_Date = req.body.Grant_Date;
        const Expiration_Date = req.body.Expiration_Date;

        console.log("Grant_Date", Grant_Date);
        console.log("Expiration_Date", Expiration_Date);

        function convertDateFormat(dateString) {
            // Define the possible date formats
            const formats = ['MM/DD/YYYY', 'DD/MM/YYYY', 'DD MMMM, YYYY', 'DD MMM, YYYY', 'DD MMMM, YYYY'];

            // Attempt to parse the input date string using each format
            let dateObject;
            for (const format of formats) {
                dateObject = moment(dateString, format, true);
                if (dateObject.isValid()) {
                    break;
                }
            }

            // Check if a valid date object was obtained
            if (dateObject && dateObject.isValid()) {
                // Convert the dateObject to moment (if it's not already)
                const momentDate = moment(dateObject);

                // Format the date to 'YY/MM/DD'
                const formattedDate = momentDate.format('MM/DD/YY');

                return formattedDate;
            } else {
                // Return null or throw an error based on your preference for handling invalid dates
                return null;
            }
        }

        // Store certificate fields in an object
        const fields = {
            Certificate_Number: Certificate_Number,
            name: name,
            courseName: courseName,
            Grant_Date: convertDateFormat(Grant_Date),
            Expiration_Date: convertDateFormat(Expiration_Date),
        };

        // Hash each field individually
        const hashedFields = {};
        for (const field in fields) {
            hashedFields[field] = calculateHash(fields[field]);
        }

        // Combine hashed fields and calculate the final hash
        const combinedHash = calculateHash(JSON.stringify(hashedFields));

        // Blockchain processing
        const contract = await web3i();
        const val = await contract.methods.verifyCertificate(combinedHash).call();

        // Check if certificate has already been issued
        if (val[0] == true && val[1] == Certificate_Number) {
            res.status(400).json({ message: "Certificate already issued" });
        } else {
            // If not issued, proceed with the issuance

            // Create a transaction to issue the certificate
            const tx = contract.methods.issueCertificate(Certificate_Number, combinedHash);

            // Confirm the transaction on the blockchain
            const hash = await confirm(tx);

            // Generate a link to view the transaction on the Polygon (Matic) blockchain
            const polygonLink = `https://polygonscan.com/tx/${hash}`;
            const dataWithLink = { ...fields, polygonLink: polygonLink }
            // Generate an encrypted URL with certificate details
            const urlLink = generateEncryptedUrl(dataWithLink);

            // Determine whether to include additional data in the QR code
            const legacyQR = false;

            let qrCodeData = '';

            if (legacyQR) {
                // Include additional data in QR code
                qrCodeData = `Verify On Blockchain: ${polygonLink},
                Certification Number: ${Certificate_Number},
                Name: ${name},
                Certification Name: ${courseName},
                Grant Date: ${Grant_Date},
                Expiration Date: ${Expiration_Date}`;

            } else {
                // Directly include the URL in QR code
                qrCodeData = urlLink;
            }

            // Generate QR code image with specified error correction level
            const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
                errorCorrectionLevel: "H",
            });

            // Assemble certificate data for response
            const certificateData = {
                Transaction_Hash: hash,
                Certificate_Hash: combinedHash,
                Certificate_Number: Certificate_Number,
                Name: name,
                Course_Name: courseName,
                Grant_Date: Grant_Date,
                Expiration_Date: Expiration_Date,
            };

            // Send the response with QR code image, Polygon link, and certificate details
            res.status(200).json({
                qrCodeImage: qrCodeImage,
                polygonLink: polygonLink,
                details: certificateData
            });
        }
    } catch (error) {
        // Handle errors and send an appropriate response
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

/**
 * Handles the decoding of a certificate from an encrypted link.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const decodeCertificate = async (req, res) => {
    try {
        // Extract encrypted link from the request body
        const encryptedData = req.body.encryptedData;
        const iv = req.body.iv;

        // Decrypt the link
        const decryptedData = decryptData(encryptedData, iv);

        const originalData = JSON.parse(decryptedData);
        let isValid = false;
        let parsedData;
        if (originalData !== null) {
            parsedData = {
                "Certificate Number": originalData.Certificate_Number || "",
                "Course Name": originalData.courseName || "",
                "Expiration Date": originalData.Expiration_Date || "",
                "Grant Date": originalData.Grant_Date || "",
                "Name": originalData.name || "",
                "Polygon URL": originalData.polygonLink || ""
            };
            isValid = true;
        }

        // Respond with the verification status and decrypted data if valid
        if (isValid) {
            res.status(200).json({ status: "PASSED", message: "Verified", data: parsedData });
        } else {
            res.status(200).json({ status: "FAILED", message: "Not Verified" });
        }
    } catch (error) {
        // Handle errors and send an appropriate response
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Export the functions for use in other modules
module.exports = {
    issueCertificate,
    decodeCertificate
};
