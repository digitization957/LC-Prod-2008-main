-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: compliance_portal
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `agencies`
--

DROP TABLE IF EXISTS `agencies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agencies` (
  `agency_id` int NOT NULL AUTO_INCREMENT,
  `plant_id` int NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text,
  `created_by` varchar(64) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`agency_id`),
  UNIQUE KEY `plant_id` (`plant_id`,`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `agencies`
--

LOCK TABLES `agencies` WRITE;
/*!40000 ALTER TABLE `agencies` DISABLE KEYS */;
INSERT INTO `agencies` VALUES (1,1,'Pollution Control Board','State pollution control filings','TOKEN-ANANYA',1,'2026-07-21 17:12:19','2026-07-25 11:48:21'),(2,1,'Labour Department','Labour law compliances','TOKEN-ANANYA',1,'2026-07-21 17:12:19','2026-07-25 11:48:21'),(3,2,'Fire Department','Fire safety certifications','TOKEN-ANANYA',1,'2026-07-21 17:12:19','2026-07-25 11:48:21'),(4,2,'DISH','description for dish','TOKEN-ANANYA',1,'2026-07-25 15:28:51','2026-07-25 15:28:51');
/*!40000 ALTER TABLE `agencies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_log`
--

DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_log` (
  `audit_id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) NOT NULL,
  `action` varchar(100) DEFAULT NULL,
  `entity_type` varchar(50) DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `details` json DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_id`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log`
--

LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
INSERT INTO `audit_log` VALUES (1,'TOKEN-VIKRAM','MARK_COMPLETE','compliance',1,NULL,'2026-07-21 17:14:09'),(2,'TOKEN-VIKRAM','MARK_COMPLETE','compliance',1,NULL,'2026-07-23 14:17:59'),(3,'TOKEN-VIKRAM','MARK_COMPLETE','compliance',3,NULL,'2026-07-23 14:22:10'),(4,'TOKEN-VIKRAM','MARK_COMPLETE','compliance',3,NULL,'2026-07-23 14:25:20'),(5,'TOKEN-PRIYA','MARK_COMPLETE','compliance',2,NULL,'2026-07-23 14:28:25'),(6,'TOKEN-VIKRAM','MARK_COMPLETE','compliance',3,NULL,'2026-07-23 14:34:27'),(7,'TOKEN-VIKRAM','MARK_COMPLETE','compliance',3,NULL,'2026-07-23 14:40:31'),(8,'TOKEN-VIKRAM','MARK_COMPLETE','compliance',3,NULL,'2026-07-23 15:07:55'),(9,'TOKEN-VIKRAM','MARK_COMPLETE','compliance',3,NULL,'2026-07-23 15:11:06'),(10,'TOKEN-VIKRAM','MARK_COMPLETE','compliance',1,NULL,'2026-07-23 15:38:06'),(11,'TOKEN-VIKRAM','MARK_COMPLETE','compliance',3,NULL,'2026-07-23 16:26:07'),(12,'TOKEN-VIKRAM','MARK_COMPLETE','compliance',3,NULL,'2026-07-24 14:22:53'),(13,'TOKEN-VIKRAM','MARK_COMPLETE','compliance',3,NULL,'2026-07-24 14:29:22'),(14,'TOKEN-VIKRAM','MARK_COMPLETE','compliance',3,NULL,'2026-07-24 14:38:15'),(15,'TOKEN-VIKRAM','MARK_COMPLETE','compliance',3,NULL,'2026-07-24 17:07:33'),(16,'TOKEN-VIKRAM','MARK_COMPLETE','compliance',3,NULL,'2026-07-25 09:34:25'),(17,'TOKEN-ANANYA','CREATE_COMPLIANCE','compliance',5,NULL,'2026-07-25 12:01:41'),(18,'TOKEN-VIKRAM','REVERT_FULFILLMENT','compliance',3,NULL,'2026-07-25 14:09:59'),(19,'TOKEN-VIKRAM','REVERT_FULFILLMENT','compliance',3,NULL,'2026-07-25 14:43:25'),(20,'TOKEN-VIKRAM','REVERT_FULFILLMENT','compliance',3,NULL,'2026-07-25 14:45:43'),(21,'TOKEN-ANANYA','CREATE_AGENCY','agency',4,NULL,'2026-07-25 15:28:51'),(22,'TOKEN-ANANYA','CREATE_COMPLIANCE','compliance',6,NULL,'2026-07-25 15:30:59'),(23,'TOKEN-MEERA','MARK_COMPLETE','compliance',6,NULL,'2026-07-25 15:32:45'),(24,'TOKEN-MEERA','MARK_COMPLETE','compliance',6,NULL,'2026-07-25 15:36:47'),(25,'TOKEN-MEERA','REVERT_FULFILLMENT','compliance',6,NULL,'2026-07-25 15:37:54'),(26,'TOKEN-VIKRAM','MARK_COMPLETE','compliance',1,NULL,'2026-07-27 16:41:14'),(27,'TOKEN-VIKRAM','REVERT_FULFILLMENT','compliance',1,NULL,'2026-07-27 16:41:30'),(28,'TOKEN-ANANYA','CREATE_COMPLIANCE','compliance',7,NULL,'2026-07-27 17:16:50'),(29,'TOKEN-VIKRAM','MARK_COMPLETE','compliance',7,NULL,'2026-07-27 17:17:11'),(30,'TOKEN-ANANYA','CREATE_COMPLIANCE','compliance',8,NULL,'2026-07-27 17:17:25'),(31,'TOKEN-VIKRAM','MARK_COMPLETE','compliance',8,NULL,'2026-07-27 17:17:25'),(32,'TOKEN-ANANYA','CREATE_COMPLIANCE','compliance',9,NULL,'2026-07-27 17:42:44'),(33,'TOKEN-VIKRAM','MARK_COMPLETE','compliance',9,NULL,'2026-07-27 17:43:04');
/*!40000 ALTER TABLE `audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `compliance_attachments`
--

DROP TABLE IF EXISTS `compliance_attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `compliance_attachments` (
  `attachment_id` int NOT NULL AUTO_INCREMENT,
  `log_id` int DEFAULT NULL,
  `compliance_id` int DEFAULT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_url` varchar(500) NOT NULL,
  `file_size_kb` int DEFAULT NULL,
  `uploaded_by` varchar(64) DEFAULT NULL,
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`attachment_id`),
  KEY `log_id` (`log_id`),
  KEY `compliance_id` (`compliance_id`),
  CONSTRAINT `compliance_attachments_ibfk_1` FOREIGN KEY (`log_id`) REFERENCES `compliance_logs` (`log_id`),
  CONSTRAINT `compliance_attachments_ibfk_2` FOREIGN KEY (`compliance_id`) REFERENCES `compliances` (`compliance_id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `compliance_attachments`
--

LOCK TABLES `compliance_attachments` WRITE;
/*!40000 ALTER TABLE `compliance_attachments` DISABLE KEYS */;
INSERT INTO `compliance_attachments` VALUES (1,3,3,'21e119ff6a614f15ad22d2be96151868.pdf','21e119ff6a614f15ad22d2be96151868.pdf',NULL,'TOKEN-VIKRAM','2026-07-23 14:22:09'),(2,4,3,'test.pdf','6366c7bc0ea041558eb6dbc3d22728ae.pdf',NULL,'TOKEN-VIKRAM','2026-07-23 14:25:20'),(3,5,2,'Project Report  front  pdf.pdf','ce1cbc5fe4474a30b6a8e7badbae6e0d.pdf',NULL,'TOKEN-PRIYA','2026-07-23 14:28:25'),(4,6,3,'valid.pdf','834d184cab9149849bc7f3595fbdc4bd.pdf',NULL,'TOKEN-VIKRAM','2026-07-23 14:34:27'),(5,7,3,'valid.pdf','61f8adb759594cd5bfb8c32ff139f002.pdf',NULL,'TOKEN-VIKRAM','2026-07-23 14:40:31'),(6,8,3,'valid.pdf','1229b02dfbaf459f8b83727c139cea72.pdf',NULL,'TOKEN-VIKRAM','2026-07-23 15:07:55'),(7,8,3,'valid.pdf','60b3fe089f0141f6868d113b4f0349d2.pdf',NULL,'TOKEN-VIKRAM','2026-07-23 15:07:55'),(8,8,3,'valid.pdf','d8977219af9348af97071c13bb443990.pdf',NULL,'TOKEN-VIKRAM','2026-07-23 15:07:55'),(9,9,3,'thesis.pdf','de68fd3cb93849d88340303db3af6c44.pdf',NULL,'TOKEN-VIKRAM','2026-07-23 15:11:06'),(10,10,1,'IJCRT2304417.pdf','fcc5b2cd930645e0b83cf37adedd7d12.pdf',NULL,'TOKEN-VIKRAM','2026-07-23 15:38:06'),(11,12,3,'Project Report  front  pdf.pdf','4afa318d265346febfe13072451cb177.pdf',NULL,'TOKEN-VIKRAM','2026-07-24 14:22:53'),(14,17,6,'Getting_Started_Owner.pdf','e4bad9d3159744fbb40cafd93f5ff36c.pdf',NULL,'TOKEN-MEERA','2026-07-25 15:32:45');
/*!40000 ALTER TABLE `compliance_attachments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `compliance_history`
--

DROP TABLE IF EXISTS `compliance_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `compliance_history` (
  `history_id` int NOT NULL AUTO_INCREMENT,
  `compliance_id` int NOT NULL,
  `field_name` varchar(50) NOT NULL,
  `old_value` varchar(255) DEFAULT NULL,
  `new_value` varchar(255) DEFAULT NULL,
  `changed_by` varchar(64) NOT NULL,
  `changed_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`history_id`),
  KEY `compliance_id` (`compliance_id`),
  CONSTRAINT `compliance_history_ibfk_1` FOREIGN KEY (`compliance_id`) REFERENCES `compliances` (`compliance_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `compliance_history`
--

LOCK TABLES `compliance_history` WRITE;
/*!40000 ALTER TABLE `compliance_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `compliance_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `compliance_log_reverts`
--

DROP TABLE IF EXISTS `compliance_log_reverts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `compliance_log_reverts` (
  `revert_id` int NOT NULL AUTO_INCREMENT,
  `compliance_id` int NOT NULL,
  `original_log_id` int NOT NULL,
  `action_date` date NOT NULL,
  `done_by` varchar(64) NOT NULL,
  `remarks` text,
  `attachments_json` text,
  `logged_at` datetime NOT NULL,
  `next_due_date_before_revert` date NOT NULL,
  `next_due_date_after_revert` date NOT NULL,
  `reverted_by` varchar(64) NOT NULL,
  `revert_reason` varchar(250) NOT NULL,
  `reverted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewer_token` varchar(64) DEFAULT NULL,
  `reviewer_email` varchar(255) DEFAULT NULL,
  `mail_sent` tinyint(1) NOT NULL DEFAULT '0',
  `mail_error` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`revert_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `compliance_log_reverts`
--

LOCK TABLES `compliance_log_reverts` WRITE;
/*!40000 ALTER TABLE `compliance_log_reverts` DISABLE KEYS */;
INSERT INTO `compliance_log_reverts` VALUES (2,3,15,'2026-07-24','TOKEN-VIKRAM','hjhhhjjk','[{\"fileName\":\"Summary_-_Owner-wise_-_Chennai_Plant.pdf\",\"fileUrl\":\"1acb8f6257b04ff991bafc422a452a2a.pdf\"}]','2026-07-24 17:07:33','2026-08-24','2026-08-24','TOKEN-VIKRAM','put the details wrongly','2026-07-25 14:43:25','TOKEN-KARTHIK','TOKEN-KARTHIK@mahindra.com',0,'SMTP not configured (access.ngpdigital is empty).'),(3,3,14,'2026-07-24','TOKEN-VIKRAM','wew','[]','2026-07-24 14:38:15','2026-08-24','2026-08-24','TOKEN-VIKRAM','sorry for the wrong things!','2026-07-25 14:45:43','TOKEN-KARTHIK','TOKEN-KARTHIK@mahindra.com',0,'SMTP not configured (access.ngpdigital is empty).'),(4,6,18,'2026-08-13','TOKEN-MEERA','lklh huy mkh','[{\"fileName\":\"finalsynopsis (1).pdf\",\"fileUrl\":\"a33bf4b32d9a46dfa040db2f58518468.pdf\"},{\"fileName\":\"Getting_Started_Owner.pdf\",\"fileUrl\":\"58581b842aee47e48355d893a0af61b8.pdf\"},{\"fileName\":\"PF_Monthly_Filing_-_Chennai_Plant.pdf\",\"fileUrl\":\"8a5deb48879749ddb0c35c66dedff61e.pdf\"}]','2026-07-25 15:36:47','2026-09-13','2026-08-25','TOKEN-MEERA','wrongly put','2026-07-25 15:37:54','TOKEN-SNEHA','TOKEN-SNEHA@mahindra.com',0,'SMTP not configured (access.ngpdigital is empty).'),(5,1,19,'2026-07-27','TOKEN-VIKRAM','revert test','[{\"fileName\":\"test_revert.pdf\",\"fileUrl\":\"fcec02f4c6f846119f364ec473cf137d.pdf\"}]','2026-07-27 16:41:14','2027-07-27','2027-07-23','TOKEN-VIKRAM','testing that revert deletes the physical file too','2026-07-27 16:41:30','TOKEN-KARTHIK','TOKEN-KARTHIK@mahindra.com',0,'SMTP not configured (access.ngpdigital is empty).');
/*!40000 ALTER TABLE `compliance_log_reverts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `compliance_logs`
--

DROP TABLE IF EXISTS `compliance_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `compliance_logs` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `compliance_id` int NOT NULL,
  `action_date` date NOT NULL,
  `done_by` varchar(64) NOT NULL,
  `remarks` text,
  `next_due_date_snapshot` date DEFAULT NULL,
  `report_link_used_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `compliance_id` (`compliance_id`),
  CONSTRAINT `compliance_logs_ibfk_1` FOREIGN KEY (`compliance_id`) REFERENCES `compliances` (`compliance_id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `compliance_logs`
--

LOCK TABLES `compliance_logs` WRITE;
/*!40000 ALTER TABLE `compliance_logs` DISABLE KEYS */;
INSERT INTO `compliance_logs` VALUES (1,1,'2026-07-21','TOKEN-VIKRAM','Filed renewal, ref# ABC123','2027-07-21',NULL,'2026-07-21 17:14:09'),(2,1,'2026-07-23','TOKEN-VIKRAM','testing purpose','2027-07-23',NULL,'2026-07-23 14:17:59'),(3,3,'2026-07-23','TOKEN-VIKRAM','Filed via portal, ref #4521','2026-08-23',NULL,'2026-07-23 14:22:09'),(4,3,'2026-07-23','TOKEN-VIKRAM','Filed via portal, ref #4521','2026-08-23',NULL,'2026-07-23 14:25:20'),(5,2,'2026-07-23','TOKEN-PRIYA','','2026-08-23',NULL,'2026-07-23 14:28:25'),(6,3,'2026-07-23','TOKEN-VIKRAM','test valid pdf','2026-08-23',NULL,'2026-07-23 14:34:27'),(7,3,'2026-07-23','TOKEN-VIKRAM','test valid pdf','2026-08-23',NULL,'2026-07-23 14:40:31'),(8,3,'2026-07-23','TOKEN-VIKRAM','Testing remarks persistence across attach','2026-08-23',NULL,'2026-07-23 15:07:55'),(9,3,'2026-07-23','TOKEN-VIKRAM','worked ','2026-08-23',NULL,'2026-07-23 15:11:06'),(10,1,'2026-07-23','TOKEN-VIKRAM','Filed','2027-07-23',NULL,'2026-07-23 15:38:06'),(11,3,'2026-07-23','TOKEN-VIKRAM','Filed & renewed - ref #99','2026-08-23',NULL,'2026-07-23 16:26:07'),(12,3,'2026-07-24','TOKEN-VIKRAM','dddd','2026-08-24',NULL,'2026-07-24 14:22:53'),(13,3,'2026-07-24','TOKEN-VIKRAM','done','2026-08-24',NULL,'2026-07-24 14:29:22'),(17,6,'2026-07-25','TOKEN-MEERA','gghu','2026-08-25',NULL,'2026-07-25 15:32:45');
/*!40000 ALTER TABLE `compliance_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `compliances`
--

DROP TABLE IF EXISTS `compliances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `compliances` (
  `compliance_id` int NOT NULL AUTO_INCREMENT,
  `agency_id` int NOT NULL,
  `plant_id` int NOT NULL,
  `name` varchar(200) NOT NULL,
  `category` varchar(50) DEFAULT NULL,
  `description` text,
  `owner_token` varchar(64) NOT NULL,
  `reviewer_token` varchar(64) DEFAULT NULL,
  `start_date` date NOT NULL,
  `frequency_number` int NOT NULL,
  `frequency_unit` enum('day','week','month','year') NOT NULL,
  `next_due_date` date NOT NULL,
  `status` enum('pending','completed','overdue') DEFAULT 'pending',
  `financial_year` varchar(12) DEFAULT NULL,
  `created_by` varchar(64) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`compliance_id`),
  KEY `agency_id` (`agency_id`),
  KEY `plant_id` (`plant_id`,`agency_id`),
  KEY `next_due_date` (`next_due_date`),
  KEY `financial_year` (`financial_year`),
  CONSTRAINT `compliances_ibfk_1` FOREIGN KEY (`agency_id`) REFERENCES `agencies` (`agency_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `compliances`
--

LOCK TABLES `compliances` WRITE;
/*!40000 ALTER TABLE `compliances` DISABLE KEYS */;
INSERT INTO `compliances` VALUES (1,1,1,'Consent to Operate Renewal',NULL,NULL,'TOKEN-VIKRAM','TOKEN-KARTHIK','2026-01-15',1,'year','2027-07-23','completed','F28','TOKEN-ANANYA',1,'2026-07-21 17:12:19','2026-07-27 16:41:30'),(2,1,1,'Hazardous Waste Return',NULL,NULL,'TOKEN-PRIYA','TOKEN-RAHUL','2026-06-01',1,'month','2026-08-23','completed','F27','TOKEN-ANANYA',1,'2026-07-21 17:12:19','2026-07-25 11:48:20'),(3,2,1,'PF Monthly Filing',NULL,NULL,'TOKEN-VIKRAM','TOKEN-KARTHIK','2026-06-01',1,'month','2026-08-24','completed','F27','TOKEN-ANANYA',1,'2026-07-21 17:12:19','2026-07-25 14:09:59'),(4,3,2,'Fire NOC Renewal',NULL,NULL,'TOKEN-MEERA','TOKEN-SNEHA','2025-08-01',1,'year','2026-08-01','pending','F27','TOKEN-ANANYA',1,'2026-07-21 17:12:19','2026-07-25 11:48:20'),(6,4,2,'Factory audit',NULL,'','TOKEN-MEERA','TOKEN-SNEHA','2026-07-25',1,'month','2026-08-25','completed','F27','TOKEN-ANANYA',1,'2026-07-25 15:30:59','2026-07-25 15:37:54');
/*!40000 ALTER TABLE `compliances` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `local_sessions`
--

DROP TABLE IF EXISTS `local_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `local_sessions` (
  `session_id` varchar(64) NOT NULL,
  `token` varchar(64) NOT NULL,
  `role` enum('master','owner','reviewer') NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `local_sessions`
--

LOCK TABLES `local_sessions` WRITE;
/*!40000 ALTER TABLE `local_sessions` DISABLE KEYS */;
INSERT INTO `local_sessions` VALUES ('_DxBzM74Czm-VZ56pw72whqyHYqp9qEea3naqj4B3kk','TOKEN-VIKRAM','owner','2026-07-25 15:14:04','2026-07-25 10:14:05'),('2ZE3M99x2mXalFpSjbg3R3xrzOMPGGfqT1c7NJcxgDU','TOKEN-ANANYA','master','2026-07-25 15:27:57','2026-07-25 10:27:57'),('3AN8DgLVGi22n07cSr0oI8jsxmjsdxN7yiWPez0mtns','TOKEN-VIKRAM','owner','2026-07-25 12:39:14','2026-07-25 07:39:15'),('4Z-WBUUvgWgEQDJ-ScbNkQ3S2ed_dm-Cbwbc6uyzrQg','TOKEN-ANANYA','master','2026-07-25 12:01:12','2026-07-25 07:01:12'),('54WlJi5bycOneZGUWTyTs9Zn6qedCC4Yf59UOn8v560','TOKEN-VIKRAM','owner','2026-07-27 17:17:02','2026-07-27 12:17:03'),('6AUKtUC29mgHEux_H1nS8ZnzDVD_EoR4aPnuiErDHgo','TOKEN-VIKRAM','owner','2026-07-27 17:23:15','2026-07-27 12:23:15'),('6CzqY-pZAKheYEfNY4ZMDxDvsTuuDh_LXQidOO4VZG8','TOKEN-VIKRAM','owner','2026-07-25 12:24:40','2026-07-25 07:24:41'),('9Ibp7Hi_h5QgPIgVkHax4iXt9juIU7-RRAkttvgWJdg','TOKEN-VIKRAM','owner','2026-07-25 14:06:33','2026-07-25 09:06:33'),('cQR4ciXB_pUVH2uYdBo5vzj4BzR-2kypb6MEo0HyfUU','TOKEN-KARTHIK','reviewer','2026-07-25 14:11:49','2026-07-25 09:11:49'),('dDTTaZHxfE0WFlwWuWoOja39c5VRoFmCPHLJgIiNGJU','TOKEN-VIKRAM','owner','2026-07-25 12:05:03','2026-07-25 07:05:04'),('DLdq0IyG6i_x36Oe0NHJiEa8oycma83vLtVoXDjH-yU','TOKEN-ANANYA','master','2026-07-25 13:30:38','2026-07-25 08:30:38'),('DM17GfMa_Oay956btAGd8AO-rHij3gfVr43S_NxlT1U','TOKEN-MEERA','owner','2026-07-25 15:31:42','2026-07-25 10:31:42'),('E8fHvYlBD-P58zNKnUTIhAwAszFcIPDBYU0eUo66VSU','TOKEN-VIKRAM','owner','2026-07-25 13:09:42','2026-07-25 08:09:43'),('ERzO-mnPWjS4g4B9E1aZTBuXdxi4aA5V4d9Hdn5Shro','TOKEN-VIKRAM','owner','2026-07-25 13:32:53','2026-07-25 08:32:54'),('GCG8UgkOXuJ_BJvKtXnTd2clwZveLP0cSqtoaIW61ag','TOKEN-ANANYA','master','2026-07-25 14:50:10','2026-07-25 09:50:10'),('GqT-x2lyyz_FD1GaM5HqqvihwrH2DzeuvVGh3wXOt28','TOKEN-VIKRAM','owner','2026-07-27 17:43:03','2026-07-27 12:43:04'),('HnI_VQQWmZB29vRLOogQjozp-L7yXwFxZmQj3kIyh1I','TOKEN-VIKRAM','owner','2026-07-25 12:00:44','2026-07-25 07:00:45'),('Ibjs3Nef4ftrd--yfzfJ5kGq_MnGD1YkvEhiA4trWBA','TOKEN-ANANYA','master','2026-07-27 16:25:59','2026-07-27 11:25:59'),('JWqDbhpQrUp0ULWAZyDKobngo-uyhOAjcG7BlK_tQQc','TOKEN-VIKRAM','owner','2026-07-27 17:23:25','2026-07-27 12:23:25'),('k3WVJC7ldgt0WNyHeekD7KMcCaYEY66F9-zuYfsePnk','TOKEN-ANANYA','master','2026-07-27 17:42:44','2026-07-27 12:42:45'),('KxFsD1kG8Zu4bcvizvpxhbmFMTVWsF2cIkfkcd21p8E','TOKEN-VIKRAM','owner','2026-07-27 16:40:28','2026-07-27 11:40:28'),('LBj_-AIrJVlzD8k6cLZsTItNhZINe4HEM7ucwNhyOn0','TOKEN-VIKRAM','owner','2026-07-27 16:34:30','2026-07-27 11:34:31'),('lM524hDLGKUUbxTGac3lU5XVrljeCtYFNloAl6ASrUw','TOKEN-PRIYA','owner','2026-07-25 14:11:48','2026-07-25 09:11:48'),('LzWBUmXr35b2_40QqwV4aT2lTS1lb2B28gL_z_yalJw','TOKEN-ANANYA','master','2026-07-27 17:16:40','2026-07-27 12:16:40'),('rVRZFq2Wv3drgIwKD-Hr9RYzAH73aKZ21m9FqUbg_nc','TOKEN-VIKRAM','owner','2026-07-25 16:06:24','2026-07-25 11:06:25'),('U_8p4QZnmrstyjq-73AM1hsuZSFsot7sQekA5lzNZes','TOKEN-VIKRAM','owner','2026-07-25 12:03:33','2026-07-25 07:03:33'),('uO2WZsIP6iEHMIDShV7uoGCXDKQBopNsMeMuDKvT7Ns','TOKEN-VIKRAM','owner','2026-07-25 14:32:34','2026-07-25 09:32:35'),('Uv-nFYkF0khnhfaiOmEIbnREZ8moWL-TqH8Tb1gtja8','TOKEN-ANANYA','master','2026-07-25 12:01:41','2026-07-25 07:01:42'),('vSRcqH_vqFIpVwrGP0llu5F9SEORqEga19079EPxazA','TOKEN-VIKRAM','owner','2026-07-25 12:08:10','2026-07-25 07:08:11'),('x5h5mr3beUEFFk-hhXdn45Lf78ZvfM06HOaAwb2QnUs','TOKEN-ANANYA','master','2026-07-25 12:04:55','2026-07-25 07:04:55'),('yi5jjK61tP5FQDvIR_6EQl0KICtZDbnWMhOdLmX08QY','TOKEN-VIKRAM','owner','2026-07-25 14:50:15','2026-07-25 09:50:16');
/*!40000 ALTER TABLE `local_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `notification_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `compliance_id` int DEFAULT NULL,
  `notification_type` enum('overdue','due_this_month') NOT NULL,
  `message` varchar(500) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`),
  KEY `user_id` (`user_id`),
  KEY `compliance_id` (`compliance_id`),
  CONSTRAINT `notifications_ibfk_2` FOREIGN KEY (`compliance_id`) REFERENCES `compliances` (`compliance_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reminder_dispatch_log`
--

DROP TABLE IF EXISTS `reminder_dispatch_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reminder_dispatch_log` (
  `dispatch_id` int NOT NULL AUTO_INCREMENT,
  `reminder_id` int DEFAULT NULL,
  `compliance_id` int DEFAULT NULL,
  `scheduled_date` date NOT NULL,
  `sent_at` datetime DEFAULT NULL,
  `sent_status` enum('pending','sent','failed') DEFAULT 'pending',
  `channel` enum('email','sms','push','in_app') DEFAULT 'email',
  PRIMARY KEY (`dispatch_id`),
  KEY `reminder_id` (`reminder_id`),
  KEY `compliance_id` (`compliance_id`),
  CONSTRAINT `reminder_dispatch_log_ibfk_1` FOREIGN KEY (`reminder_id`) REFERENCES `reminders` (`reminder_id`),
  CONSTRAINT `reminder_dispatch_log_ibfk_2` FOREIGN KEY (`compliance_id`) REFERENCES `compliances` (`compliance_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reminder_dispatch_log`
--

LOCK TABLES `reminder_dispatch_log` WRITE;
/*!40000 ALTER TABLE `reminder_dispatch_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `reminder_dispatch_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reminders`
--

DROP TABLE IF EXISTS `reminders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reminders` (
  `reminder_id` int NOT NULL AUTO_INCREMENT,
  `compliance_id` int NOT NULL,
  `reminder_label` enum('R1','R2','R3','R4') NOT NULL,
  `days_before_due` int NOT NULL,
  `recipient_id` varchar(64) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reminder_id`),
  UNIQUE KEY `compliance_id` (`compliance_id`,`reminder_label`),
  CONSTRAINT `reminders_ibfk_1` FOREIGN KEY (`compliance_id`) REFERENCES `compliances` (`compliance_id`)
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reminders`
--

LOCK TABLES `reminders` WRITE;
/*!40000 ALTER TABLE `reminders` DISABLE KEYS */;
INSERT INTO `reminders` VALUES (1,1,'R1',30,NULL,1,'2026-07-21 17:12:19'),(2,1,'R2',15,NULL,1,'2026-07-21 17:12:19'),(3,1,'R3',7,NULL,1,'2026-07-21 17:12:19'),(4,1,'R4',1,NULL,1,'2026-07-21 17:12:19'),(5,2,'R1',30,NULL,1,'2026-07-21 17:12:19'),(6,2,'R2',15,NULL,1,'2026-07-21 17:12:19'),(7,2,'R3',7,NULL,1,'2026-07-21 17:12:19'),(8,2,'R4',1,NULL,1,'2026-07-21 17:12:19'),(9,3,'R1',30,NULL,1,'2026-07-21 17:12:19'),(10,3,'R2',15,NULL,1,'2026-07-21 17:12:19'),(11,3,'R3',7,NULL,1,'2026-07-21 17:12:19'),(12,3,'R4',1,NULL,1,'2026-07-21 17:12:19'),(13,4,'R1',30,'TOKEN-PRIYA',1,'2026-07-21 17:12:19'),(14,4,'R2',15,'TOKEN-PRIYA',1,'2026-07-21 17:12:19'),(15,4,'R3',7,'TOKEN-PRIYA',1,'2026-07-21 17:12:19'),(16,4,'R4',1,'TOKEN-PRIYA',1,'2026-07-21 17:12:19'),(21,6,'R1',30,'TOKEN-MEERA',1,'2026-07-25 15:30:59'),(22,6,'R2',15,'TOKEN-MEERA',1,'2026-07-25 15:30:59'),(23,6,'R3',7,'TOKEN-MEERA',1,'2026-07-25 15:30:59'),(24,6,'R4',1,'TOKEN-MEERA',1,'2026-07-25 15:30:59');
/*!40000 ALTER TABLE `reminders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `training_completions`
--

DROP TABLE IF EXISTS `training_completions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `training_completions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `token` varchar(64) NOT NULL,
  `plant_id` int NOT NULL,
  `completed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `training_completions`
--

LOCK TABLES `training_completions` WRITE;
/*!40000 ALTER TABLE `training_completions` DISABLE KEYS */;
INSERT INTO `training_completions` VALUES (2,'TOKEN-VIKRAM',1,'2026-07-25 12:25:51'),(3,'TOKEN-VIKRAM',1,'2026-07-25 13:47:41'),(4,'TOKEN-VIKRAM',1,'2026-07-25 14:50:44'),(5,'TOKEN-VIKRAM',1,'2026-07-25 14:52:19'),(6,'TOKEN-MEERA',2,'2026-07-25 15:44:10');
/*!40000 ALTER TABLE `training_completions` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-28 14:16:51
