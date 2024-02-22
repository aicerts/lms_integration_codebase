const express = require("express");
const multer = require("multer");
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const bodyParser = require('body-parser');
const path = require("path");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 8000;
const pdf = require("pdf-lib");
const { PDFDocument, Rectangle } = pdf;
const fs = require("fs");
const calculateHash = require("./calculateHash");
const web3i = require("./web3i");
const confirm = require("./confirm");
const QRCode = require("qrcode");
const { fromPath } = require("pdf2pic");
const { PNG } = require("pngjs");
const jsQR = require("jsqr");
// Load environment variables from .env file
require('dotenv').config();
var pdfBytes;
let detailsQR;

// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Certificate API',
      version: '1.0.0',
      description: 'API documentation for Certificate module',
    },
    components: {
      schemas: {
        Certificate: {
          type: 'object',
          properties: {
            Certificate_Number: { type: 'string' },
            name: { type: 'string' },
            courseName: { type: 'string' },
            Grant_Date: { type: 'string' },
            Expiration_Date: { type: 'string' },
          },
          required: ['Certificate_Number', 'name', 'courseName', 'Grant_Date', 'Expiration_Date'],
        },
        DetailsQR: {
          type: 'object',
          properties: {
            Verify_On_Blockchain: { type: 'string' },
            Certification_Number: { type: 'string' },
            Name: { type: 'string' },
            Certification_Name: { type: 'string' },
            Grant_Date: { type: 'string' },
            Expiration_Date: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['app.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

function extractCertificateInfo(qrCodeText) {
  const lines = qrCodeText.split("\n");
  const certificateInfo = {
    "Certificate Hash": "",
    "Certificate Number": "",
  };

  for (const line of lines) {
    const parts = line.trim().split(":");
    if (parts.length === 2) {
      const key = parts[0].trim();
      let value = parts[1].trim();

      value = value.replace(/,/g, "");

      if (key === "Certificate Hash") {
        certificateInfo["Certificate Hash"] = value;
      } else if (key === "Certificate Number") {
        certificateInfo["Certificate Number"] = value;
      }
    }
  }

  return certificateInfo;
}

// Function to extract QR code from a PDF
async function extractQRCodeDataFromPDF(pdfFilePath) {
  try {
    const pdf2picOptions = {
      quality: 100,
      density: 300,
      format: "png",
      width: 2000,
      height: 2000,
    };

    const base64Response = await fromPath(pdfFilePath, pdf2picOptions)(
      1,
      true
    );
    const dataUri = base64Response?.base64;

    if (!dataUri)
      throw new Error("PDF could not be converted to Base64 string");

    const buffer = Buffer.from(dataUri, "base64");
    const png = PNG.sync.read(buffer);

    const code = jsQR(Uint8ClampedArray.from(png.data), png.width, png.height);
    const qrCodeText = code?.data;

    if (!qrCodeText)
      throw new Error("QR Code Text could not be extracted from PNG image");

    console.log("QR Code Text:==> ", qrCodeText);

    detailsQR = qrCodeText;
    const certificateInfo = extractCertificateInfo(qrCodeText);

    return certificateInfo;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

app.use(cors());
app.use(bodyParser.json());

// Set up multer storage and file filter
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads");
  },
  filename: (req, file, cb) => {
    const Certificate_Number = req.body.Certificate_Number;
    cb(null, file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(
      new Error("Invalid file type. Only JPEG and PNG files are allowed."),
      false
    );
  }
};

const upload = multer({ storage, fileFilter });
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(require('./routes'))
app.get("/", (req, res) => {
  res.redirect("/api-docs");
});

/**
 * @swagger
 * tags:
 *   - name: Issuer
 *     description: APIs for issuing certificates
 *   - name: Verifier
 *     description: APIs for verifying certificates
 */

/**
 * @swagger
 * /api/verify-decrypt:
 *   post:
 *     summary: Verify a certificate with encryption
 *     tags: [Verifier]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               encryptedData:
 *                 type: string
 *                 description: Encrypted data containing certificate information
 *               iv:
 *                 type: string
 *                 description: Initialization vector used for encryption
 *     responses:
 *       '200':
 *         description: Certificate decoded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Verification status (PASSED)
 *                 message:
 *                   type: string
 *                   description: Verification result message
 *                 data:
 *                   type: object
 *                   properties:
 *                     Certificate Hash:
 *                       type: string
 *                       description: Certificate hash
 *                     Certificate Number:
 *                       type: string
 *                       description: Certificate number
 *                     Course Name:
 *                       type: string
 *                       description: Name of the course
 *                     Expiration Date:
 *                       type: string
 *                       description: Date of certificate expiration
 *                     Grant Date:
 *                       type: string
 *                       description: Date of certificate grant
 *                     Name:
 *                       type: string
 *                       description: Recipient's name
 *                     Transaction Hash:
 *                       type: string
 *                       description: Transaction hash associated with the certificate
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */

/**
 * @swagger
 * /api/issue:
 *   post:
 *     summary: Issue a certificate
 *     tags: [Issuer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Certificate_Number:
 *                 type: string
 *                 description: Certificate number
 *               name:
 *                 type: string
 *                 description: Recipient's name
 *               courseName:
 *                 type: string
 *                 description: Name of the course
 *               Grant_Date:
 *                 type: string
 *                 description: Date of certificate grant
 *               Expiration_Date:
 *                 type: string
 *                 description: Date of certificate expiration
 *     responses:
 *       '200':
 *         description: Certificate issued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 qrCodeImage:
 *                   type: string
 *                   description: Base64-encoded PNG image of the QR code
 *                 polygonLink:
 *                   type: string
 *                   description: Polygon link for the certificate transaction
 *                 details:
 *                   type: object
 *                   properties:
 *                     Transaction_Hash:
 *                       type: string
 *                       description: Transaction hash associated with the certificate issuance
 *                     Certificate_Hash:
 *                       type: string
 *                       description: Combined hash of certificate fields
 *                     Certificate_Number:
 *                       type: string
 *                       description: Certificate number
 *                     Name:
 *                       type: string
 *                       description: Recipient's name
 *                     Course_Name:
 *                       type: string
 *                       description: Name of the course
 *                     Grant_Date:
 *                       type: string
 *                       description: Date of certificate grant
 *                     Expiration_Date:
 *                       type: string
 *                       description: Date of certificate expiration
 *       '400':
 *         description: Certificate already issued or other error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */


app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
