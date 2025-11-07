CREATE TABLE `deviceProducts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int NOT NULL,
	`productId` int NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`displayOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deviceProducts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `faceRecognition` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`faceEmbedding` text NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`stripeCustomerId` varchar(255),
	`paymentMethodId` varchar(255),
	`maxPaymentAmount` int NOT NULL DEFAULT 5000,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastUsedAt` timestamp,
	CONSTRAINT `faceRecognition_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gestureEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int NOT NULL,
	`userId` int,
	`gestureType` enum('pick_up','put_down','yes','no','hold') NOT NULL,
	`confidence` int NOT NULL,
	`productId` int,
	`state` enum('S0_waiting','S1_approaching','S2_picked','S3_checkout','S4_completed') NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gestureEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `walletTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`walletId` int NOT NULL,
	`type` enum('deposit','withdraw','payment','refund','transfer') NOT NULL,
	`amount` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`status` enum('pending','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`relatedOrderId` int,
	`description` text,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `walletTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`walletType` enum('custodial','non_custodial') NOT NULL,
	`walletAddress` varchar(255),
	`balance` int NOT NULL DEFAULT 0,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`isDefault` int NOT NULL DEFAULT 0,
	`status` enum('active','frozen','closed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wallets_id` PRIMARY KEY(`id`)
);
