const {Certificate} = require('../services')

module.exports={
    issueCertificate : async(req,res)=>{
       await Certificate.issueCertificate(req, res)
    },
    decodeCertificate : async(req,res)=>{
        await Certificate.decodeCertificate(req, res)
     }
}
