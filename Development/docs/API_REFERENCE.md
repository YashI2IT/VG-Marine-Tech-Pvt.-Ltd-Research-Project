# Backend API Reference Manual

## Authentication Endpoints (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate email/password and set JWT cookie | No |
| `POST` | `/api/auth/register` | Register new user account with role | No |
| `POST` | `/api/auth/logout` | Clear session token | Yes |
| `GET`  | `/api/auth/me` | Fetch authenticated user profile | Yes |

## Administration Suite Endpoints (`/api/admin`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET`  | `/api/admin/stats` | Platform user count, traffic & active tasks | Yes (Admin) |
| `GET`  | `/api/admin/traffic` | Hourly request ingress & route breakdown | Yes (Admin) |
| `GET`  | `/api/admin/users` | Full user pool listing | Yes (Admin) |
| `GET`  | `/api/admin/maintenance` | Fleet battery service orders & health | Yes (Admin) |
| `GET`  | `/api/admin/billing` | Invoices, subscription tiers & transactions | Yes (Admin) |

## Virtual Sensor Inference (`/api/virtual-sensor`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/virtual-sensor/predict` | Upload `.mat` file for CNN-LSTM prediction | No |
