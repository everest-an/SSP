CREATE TABLE `face_index_map` (
	`id` int AUTO_INCREMENT NOT NULL,
	`faceProfileId` int NOT NULL,
	`vectorDbId` varchar(255) NOT NULL,
	`vectorDbName` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `face_index_map_id` PRIMARY KEY(`id`),
	CONSTRAINT `face_index_map_faceProfileId_unique` UNIQUE(`faceProfileId`),
	CONSTRAINT `face_index_map_vectorDbId_unique` UNIQUE(`vectorDbId`)
);
--> statement-breakpoint
CREATE TABLE `face_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`faceTemplateEncrypted` binary(2048) NOT NULL,
	`templateKmsKeyId` varchar(255) NOT NULL,
	`modelVersion` varchar(50) NOT NULL,
	`enrollmentQuality` decimal(3,2),
	`deviceFingerprint` varchar(255),
	`status` enum('active','inactive','revoked') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastUsedAt` timestamp,
	`revokedAt` timestamp,
	`revokedReason` text,
	CONSTRAINT `face_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `face_verification_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`faceProfileId` int,
	`action` varchar(50) NOT NULL,
	`result` enum('success','failed','rejected') NOT NULL,
	`confidenceScore` decimal(5,4),
	`livenessScore` decimal(5,4),
	`livenessMethod` varchar(50),
	`failureReason` varchar(255),
	`ipAddress` varchar(45),
	`userAgent` text,
	`deviceFingerprint` varchar(255),
	`geoLocation` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `face_verification_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('card','metamask','custodial_wallet') NOT NULL,
	`isDefault` tinyint NOT NULL DEFAULT 0,
	`stripePaymentMethodId` varchar(255),
	`stripeCustomerId` varchar(255),
	`cardBrand` varchar(50),
	`cardLast4` varchar(4),
	`cardExpMonth` int,
	`cardExpYear` int,
	`walletAddress` varchar(255),
	`walletType` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_methods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_identities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(50) NOT NULL,
	`providerSubject` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_identities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_security_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`mfaEnabled` boolean NOT NULL DEFAULT false,
	`mfaSecret` varchar(255),
	`mfaBackupCodes` text,
	`faceAuthEnabled` boolean NOT NULL DEFAULT false,
	`passwordLastChanged` timestamp,
	`lastSecurityReview` timestamp,
	`trustedDevices` text,
	`securityNotifications` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_security_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_security_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(255);