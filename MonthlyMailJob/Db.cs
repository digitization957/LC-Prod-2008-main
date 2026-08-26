using System;
using System.Collections.Generic;
using System.Configuration;
using MySqlConnector;

namespace MonthlyMailJob
{
    // Trimmed copy of ComplianceV2.2/App_Code/Db.cs - this is a standalone console app, not part of the web app.
    public static class Db
    {
        private static string ConnStr
        {
            get { return ConfigurationManager.ConnectionStrings["ComplianceDb"].ConnectionString; }
        }

        public static List<Dictionary<string, object>> Query(string sql, params MySqlParameter[] args)
        {
            var rows = new List<Dictionary<string, object>>();
            using (var conn = new MySqlConnection(ConnStr))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    if (args != null) cmd.Parameters.AddRange(args);
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            var row = new Dictionary<string, object>();
                            for (int i = 0; i < reader.FieldCount; i++)
                                row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
                            rows.Add(row);
                        }
                    }
                }
            }
            return rows;
        }

        public static Dictionary<string, object> QuerySingle(string sql, params MySqlParameter[] args)
        {
            var rows = Query(sql, args);
            return rows.Count > 0 ? rows[0] : null;
        }

        // Returns last insert id - used for mail_job_run so the run's id can be reused on every log row.
        public static long Execute(string sql, params MySqlParameter[] args)
        {
            using (var conn = new MySqlConnection(ConnStr))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    if (args != null) cmd.Parameters.AddRange(args);
                    cmd.ExecuteNonQuery();
                    return cmd.LastInsertedId != 0 ? cmd.LastInsertedId : 0;
                }
            }
        }

        public static int ExecuteRows(string sql, params MySqlParameter[] args)
        {
            using (var conn = new MySqlConnection(ConnStr))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    if (args != null) cmd.Parameters.AddRange(args);
                    return cmd.ExecuteNonQuery();
                }
            }
        }

        public static MySqlParameter P(string name, object value)
        {
            return new MySqlParameter(name, value ?? DBNull.Value);
        }
    }
}
