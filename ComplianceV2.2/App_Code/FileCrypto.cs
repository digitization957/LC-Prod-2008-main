using System;
using System.Configuration;
using System.IO;
using System.Security.Cryptography;

namespace ComplianceV2._2.App_Code
{
    // Encrypts uploaded attachments at rest (AES-256-CBC). Key comes from Web.config
    // (appSettings FileEncKey, base64 32 bytes) - move to Azure Key Vault at real deployment.
    public static class FileCrypto
    {
        private static byte[] Key => Convert.FromBase64String(ConfigurationManager.AppSettings["FileEncKey"]);

        public static void EncryptToFile(Stream input, string destPath)
        {
            using (var aes = Aes.Create())
            {
                aes.Key = Key;
                aes.GenerateIV();
                using (var fs = new FileStream(destPath, FileMode.Create, FileAccess.Write))
                {
                    fs.Write(aes.IV, 0, aes.IV.Length);
                    using (var cs = new CryptoStream(fs, aes.CreateEncryptor(), CryptoStreamMode.Write))
                        input.CopyTo(cs);
                }
            }
        }

        public static void DecryptToStream(string srcPath, Stream output)
        {
            using (var aes = Aes.Create())
            using (var fs = new FileStream(srcPath, FileMode.Open, FileAccess.Read))
            {
                var iv = new byte[16];
                fs.Read(iv, 0, iv.Length);
                aes.Key = Key;
                aes.IV = iv;
                using (var cs = new CryptoStream(fs, aes.CreateDecryptor(), CryptoStreamMode.Read))
                    cs.CopyTo(output);
            }
        }
    }
}
