using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
using MySqlConnector;

namespace ComplianceV2._2.App_Code
{
    // ponytail: single static helper instead of a repository-per-table layer — this app has one DB, no need for DI here.
    public static class Db
    {
        private static string ConnStr => ConfigurationManager.ConnectionStrings["ComplianceDb"].ConnectionString;

        public static MySqlConnection Open()
        {
            var conn = new MySqlConnection(ConnStr);
            conn.Open();
            return conn;
        }

        // All SQL text comes from callers as literals; args are always bound as parameters — never string-concatenated.
        public static List<Dictionary<string, object>> Query(string sql, params MySqlParameter[] args)
        {
            var rows = new List<Dictionary<string, object>>();
            using (var conn = Open())
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
            return rows;
        }

        public static Dictionary<string, object> QuerySingle(string sql, params MySqlParameter[] args)
        {
            var rows = Query(sql, args);
            return rows.Count > 0 ? rows[0] : null;
        }

        // Returns last insert id for INSERTs, or affected row count for UPDATE/DELETE.
        public static long Execute(string sql, params MySqlParameter[] args)
        {
            using (var conn = Open())
            using (var cmd = new MySqlCommand(sql, conn))
            {
                if (args != null) cmd.Parameters.AddRange(args);
                cmd.ExecuteNonQuery();
                return cmd.LastInsertedId != 0 ? cmd.LastInsertedId : 0;
            }
        }

        public static int ExecuteRows(string sql, params MySqlParameter[] args)
        {
            using (var conn = Open())
            using (var cmd = new MySqlCommand(sql, conn))
            {
                if (args != null) cmd.Parameters.AddRange(args);
                return cmd.ExecuteNonQuery();
            }
        }

        public static MySqlParameter P(string name, object value)
        {
            return new MySqlParameter(name, value ?? DBNull.Value);
        }

        // Multi-statement atomic operations (e.g. revert: delete a log, restore the compliance, write an
        // audit row - all or nothing). Runs work inside one connection+transaction; any exception rolls back.
        public static void Transact(Action<MySqlConnection, MySqlTransaction> work)
        {
            using (var conn = Open())
            using (var tx = conn.BeginTransaction())
            {
                try { work(conn, tx); tx.Commit(); }
                catch { tx.Rollback(); throw; }
            }
        }

        public static long ExecuteTx(MySqlConnection conn, MySqlTransaction tx, string sql, params MySqlParameter[] args)
        {
            using (var cmd = new MySqlCommand(sql, conn, tx))
            {
                if (args != null) cmd.Parameters.AddRange(args);
                cmd.ExecuteNonQuery();
                return cmd.LastInsertedId != 0 ? cmd.LastInsertedId : 0;
            }
        }

        public static Dictionary<string, object> QuerySingleTx(MySqlConnection conn, MySqlTransaction tx, string sql, params MySqlParameter[] args)
        {
            using (var cmd = new MySqlCommand(sql, conn, tx))
            {
                if (args != null) cmd.Parameters.AddRange(args);
                using (var reader = cmd.ExecuteReader())
                {
                    if (!reader.Read()) return null;
                    var row = new Dictionary<string, object>();
                    for (int i = 0; i < reader.FieldCount; i++)
                        row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
                    return row;
                }
            }
        }
    }
}
