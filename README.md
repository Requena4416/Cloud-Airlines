# Cloud Airlines: Secure Serverless Policy Portal

![AWS](https://img.shields.io/badge/AWS-%23FF9900.svg?style=for-the-badge&logo=amazon-aws&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)

An end-to-end secure, serverless cloud environment built on Amazon Web Services (AWS) designed to host and manage sensitive internal documents for Cloud Airlines.

## ✈️ Project Overview

Cloud Airlines, a regional carrier based in Florida, required a centralized solution to standardize policies and procedures across multiple teams and locations. This project implements a **Role-Based Access Control (RBAC)** system ensuring departmental data isolation for HR, Sales, and Reservations teams.

### Key Features
- **Serverless Architecture:** Zero-maintenance infrastructure using AWS Lambda and S3.
- **Departmental Isolation:** Strict "Hard Deny" IAM policies to prevent unauthorized data access between departments.
- **Real-time Monitoring:** Integration with Amazon CloudWatch and AWS CloudTrail for a permanent, date-stamped audit log.
- **Interactive UI:** A React-based frontend featuring custom CSS animations and a responsive dashboard.

## 🏗️ System Architecture

The architecture leverages AWS managed services to ensure scalability and high availability:

1.  **Frontend:** Hosted on **Amazon S3**, delivered globally via **Amazon CloudFront**, and secured by **AWS WAF**.
2.  **Authentication:** Managed via **Amazon Cognito** Identity Pools to map users to specific **IAM Roles**.
3.  **Backend:** **API Gateway** triggers **AWS Lambda** functions (Python) for secure metadata processing.
4.  **Storage:** **Amazon S3** for document storage and **Amazon DynamoDB** for document metadata.

## 🛠️ Technology Stack

| Layer | Services |
| :--- | :--- |
| **Compute** | AWS Lambda |
| **Storage** | Amazon S3, Amazon DynamoDB |
| **Security** | AWS IAM, Amazon Cognito, AWS WAF |
| **Network** | Amazon CloudFront, Amazon API Gateway |
| **Observability** | Amazon CloudWatch, AWS CloudTrail |
| **Frontend** | React, Tailwind CSS |

## 🚀 Deployment & Local Setup

### Prerequisites
- AWS Account with administrative access.
- Local development environment (VS Code recommended).

### Steps
1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/Requena4416/Cloud-Airlines.git
    ```
2.  **AWS Setup:**
    - Create a Cognito User Pool and Identity Pool.
    - Provision S3 Buckets for frontend assets and document storage.
    - Deploy DynamoDB table `CloudAirlines_Data`.
3.  **Configure `app.js`:**
    Update the `AWS_CONFIG` object with your specific `userPoolId`, `clientId`, and `identityPoolId`.
4.  **Push to S3:**
    Upload `index.html`, `dashboard.html`, `app.js`, and `styles.css` to your public S3 bucket or distribute via CloudFront.

## 🛡️ Security Implementation
The system employs a **"Cloud-First" security strategy**:
- **Identity Logic:** Uses "Choose role from token" in Cognito to force strict group membership.
- **Storage Layer:** Implements S3 Bucket Policies that block any request not matching the authenticated user's departmental folder prefix (`policies/hr/*`, etc.).

## 📝 License
This project was developed as part of a Cloud Computing Capstone (May 2026).
