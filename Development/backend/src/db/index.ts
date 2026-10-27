import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("[PostgreSQL] DATABASE_URL environment variable is missing.");
}
const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 3000),
});

export const db = drizzle(pool, { schema });

/**
 * Validates connection to PostgreSQL and ensures schema tables are ready.
 */
export async function initDb(): Promise<void> {
  try {
    const client = await pool.connect();
    const res = await client.query("SELECT current_database(), current_user, version();");
    console.log(
      `[PostgreSQL] Connected to '${res.rows[0].current_database}' as '${res.rows[0].current_user}'`
    );

    // Ensure core tables exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tenant_users (
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (tenant_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS datasets (
        id VARCHAR(255) PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dataset_versions (
        id VARCHAR(255) PRIMARY KEY,
        dataset_id VARCHAR(255) REFERENCES datasets(id) ON DELETE CASCADE NOT NULL,
        version_tag VARCHAR(50) NOT NULL,
        s3_object_key VARCHAR(512) NOT NULL,
        checksum VARCHAR(255) NOT NULL,
        schema_version VARCHAR(50) NOT NULL,
        file_size INTEGER,
        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS processing_jobs (
        id VARCHAR(255) PRIMARY KEY,
        dataset_version_id VARCHAR(255) REFERENCES dataset_versions(id) ON DELETE CASCADE NOT NULL,
        model_version VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
        result_s3_key VARCHAR(512),
        metrics JSONB,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        completed_at TIMESTAMP
      );

      
      CREATE TABLE IF NOT EXISTS simulation_sessions (
        id VARCHAR(255) PRIMARY KEY,
        dataset_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'IDLE',
        speed DOUBLE PRECISION DEFAULT 1.0,
        total_samples INTEGER DEFAULT 0,
        processed_samples INTEGER DEFAULT 0,
        source_mode VARCHAR(50) NOT NULL DEFAULT 'DATASET_REPLAY',
        device_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS telemetry_records (
        id VARCHAR(255) PRIMARY KEY,
        session_id VARCHAR(255),
        record_index INTEGER NOT NULL,
        sample_time DOUBLE PRECISION NOT NULL,
        simulation_time TIMESTAMP NOT NULL,
        voltage_v DOUBLE PRECISION NOT NULL,
        current_a DOUBLE PRECISION NOT NULL,
        ah DOUBLE PRECISION NOT NULL,
        chamber_temp_degc DOUBLE PRECISION NOT NULL,
        power_w DOUBLE PRECISION NOT NULL,
        current_abs_a DOUBLE PRECISION NOT NULL,
        reference_temp_degc DOUBLE PRECISION,
        trust_decision VARCHAR(50) NOT NULL DEFAULT 'SAFE',
        record_hash VARCHAR(255) NOT NULL,
        batch_id VARCHAR(255),
        device_id VARCHAR(255),
        data_source VARCHAR(50) NOT NULL DEFAULT 'DATASET_REPLAY',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prediction_records (
        id VARCHAR(255) PRIMARY KEY,
        record_id VARCHAR(255),
        session_id VARCHAR(255),
        window_id VARCHAR(255) NOT NULL,
        predicted_temp_degc DOUBLE PRECISION NOT NULL,
        reference_temp_degc DOUBLE PRECISION,
        residual_degc DOUBLE PRECISION,
        absolute_error_degc DOUBLE PRECISION,
        latency_ms DOUBLE PRECISION,
        model_version VARCHAR(50) NOT NULL,
        confidence VARCHAR(50) NOT NULL DEFAULT 'VALID',
        ood_status VARCHAR(50) NOT NULL DEFAULT 'IN-DISTRIBUTION',
        status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS quarantined_records (
        id VARCHAR(255) PRIMARY KEY,
        session_id VARCHAR(255),
        record_index INTEGER,
        payload JSONB NOT NULL,
        violation_reasons JSONB NOT NULL,
        trust_decision VARCHAR(50) NOT NULL DEFAULT 'BLOCK',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS merkle_batches (
        id VARCHAR(255) PRIMARY KEY,
        session_id VARCHAR(255),
        batch_index INTEGER NOT NULL,
        merkle_root VARCHAR(255) NOT NULL,
        leaf_count INTEGER NOT NULL,
        start_record_id VARCHAR(255),
        end_record_id VARCHAR(255),
        leaves JSONB NOT NULL,
        tree_structure JSONB,
        s3_object_key VARCHAR(512),
        storage_provider VARCHAR(50) NOT NULL DEFAULT 'LOCAL_S3_COMPATIBLE',
        sha256_checksum VARCHAR(64),
        uploaded_at TIMESTAMP,
        tenant_id INTEGER NOT NULL DEFAULT 1,
        status VARCHAR(50) NOT NULL DEFAULT 'COMMITTED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      ALTER TABLE merkle_batches ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(50) DEFAULT 'LOCAL_S3_COMPATIBLE';
      ALTER TABLE merkle_batches ADD COLUMN IF NOT EXISTS sha256_checksum VARCHAR(64);
      ALTER TABLE merkle_batches ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP;
      ALTER TABLE merkle_batches ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;

      CREATE TABLE IF NOT EXISTS ledger_anchors (
        id VARCHAR(255) PRIMARY KEY,
        batch_id VARCHAR(255),
        fabric_tx_id VARCHAR(255) NOT NULL,
        block_number INTEGER NOT NULL,
        merkle_root VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL DEFAULT 'bmschannel',
        chaincode_id VARCHAR(255) NOT NULL DEFAULT 'trustsense-provenance',
        anchor_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'CONFIRMED',
        network_type VARCHAR(50) NOT NULL DEFAULT 'LOCAL_DEV_NETWORK',
        verification_status VARCHAR(50) NOT NULL DEFAULT 'VERIFIED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS battery_passports (
        id VARCHAR(255) PRIMARY KEY,
        battery_id VARCHAR(255) NOT NULL UNIQUE,
        cell_model VARCHAR(255) NOT NULL,
        chemistry VARCHAR(100) NOT NULL,
        nominal_capacity_ah DOUBLE PRECISION NOT NULL,
        nominal_voltage_v DOUBLE PRECISION NOT NULL,
        manufacturer VARCHAR(255) NOT NULL,
        manufacture_date TIMESTAMP NOT NULL,
        total_cycles INTEGER NOT NULL DEFAULT 0,
        total_batches_anchored INTEGER NOT NULL DEFAULT 0,
        latest_merkle_root VARCHAR(255),
        latest_tx_id VARCHAR(255),
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS provenance_records (
        event_id VARCHAR(255) PRIMARY KEY,
        job_id VARCHAR(255) REFERENCES processing_jobs(id) ON DELETE CASCADE,
        content_hash VARCHAR(255) NOT NULL,
        merkle_root VARCHAR(255),
        fabric_tx_id VARCHAR(255),
        verification_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id VARCHAR(255) PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        plan_id VARCHAR(100) NOT NULL,
        plan_name VARCHAR(255) NOT NULL,
        tier VARCHAR(100) NOT NULL,
        amount_monthly DOUBLE PRECISION NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        billing_cycle VARCHAR(100) NOT NULL,
        payment_method VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Active',
        current_period_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        current_period_end TIMESTAMP NOT NULL,
        razorpay_subscription_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS billing_invoices (
        id VARCHAR(255) PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        subscription_id VARCHAR(255),
        invoice_number VARCHAR(100) NOT NULL,
        amount VARCHAR(50) NOT NULL,
        amount_numeric DOUBLE PRECISION NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        status VARCHAR(50) NOT NULL DEFAULT 'Paid',
        billing_period VARCHAR(100) NOT NULL,
        razorpay_payment_id VARCHAR(255),
        pdf_url VARCHAR(512) DEFAULT '#',
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS billing_orders (
        id VARCHAR(255) PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        plan_id VARCHAR(100) NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        razorpay_order_id VARCHAR(255),
        razorpay_payment_id VARCHAR(255),
        razorpay_signature VARCHAR(255),
        status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
        mode VARCHAR(50) NOT NULL DEFAULT 'DEV_TEST_MODE',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS vehicles (
        id VARCHAR(255) PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        fleet VARCHAR(100) NOT NULL DEFAULT 'Metro North',
        status VARCHAR(50) NOT NULL DEFAULT 'healthy',
        battery_id VARCHAR(255) NOT NULL,
        device_id VARCHAR(255),
        thermal_risk VARCHAR(50) NOT NULL DEFAULT 'info',
        cooling_health VARCHAR(50) NOT NULL DEFAULT 'healthy',
        sensor_health VARCHAR(50) NOT NULL DEFAULT 'healthy',
        maintenance_priority VARCHAR(50) NOT NULL DEFAULT 'low',
        location VARCHAR(255) NOT NULL DEFAULT 'Depot A',
        tmax DOUBLE PRECISION NOT NULL DEFAULT 25.0,
        tmin DOUBLE PRECISION NOT NULL DEFAULT 24.0,
        tavg DOUBLE PRECISION NOT NULL DEFAULT 24.5,
        delta_t DOUBLE PRECISION NOT NULL DEFAULT 1.0,
        dtdt DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS work_orders (
        id VARCHAR(255) PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        vehicle_id VARCHAR(255) NOT NULL,
        pack_id VARCHAR(255),
        issue TEXT NOT NULL,
        priority VARCHAR(50) NOT NULL DEFAULT 'routine',
        assigned_to VARCHAR(255) NOT NULL DEFAULT 'Fleet Technician',
        status VARCHAR(50) NOT NULL DEFAULT 'open',
        thermal_issue TEXT,
        recommendation TEXT,
        evidence TEXT,
        due_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reports (
        id VARCHAR(255) PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        scope VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'ready',
        summary TEXT NOT NULL,
        reference VARCHAR(255) NOT NULL,
        record_count INTEGER NOT NULL DEFAULT 0,
        report_data JSONB,
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE TABLE IF NOT EXISTS company_profiles (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE NOT NULL UNIQUE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        industry VARCHAR(100) NOT NULL,
        website VARCHAR(255),
        contact_email VARCHAR(255) NOT NULL,
        organization_type VARCHAR(100) NOT NULL,
        gstin VARCHAR(50),
        is_gst_registered BOOLEAN NOT NULL DEFAULT true,
        country VARCHAR(100) NOT NULL,
        state VARCHAR(100),
        city VARCHAR(100) NOT NULL,
        postal_code VARCHAR(50) NOT NULL,
        address TEXT NOT NULL,
        fleet_size VARCHAR(50) NOT NULL,
        primary_application VARCHAR(100) NOT NULL,
        description TEXT,
        is_completed BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE simulation_sessions ADD COLUMN IF NOT EXISTS source_mode VARCHAR(50) NOT NULL DEFAULT 'DATASET_REPLAY';
      ALTER TABLE simulation_sessions ADD COLUMN IF NOT EXISTS device_id VARCHAR(255);
      ALTER TABLE telemetry_records ADD COLUMN IF NOT EXISTS device_id VARCHAR(255);
      ALTER TABLE telemetry_records ADD COLUMN IF NOT EXISTS data_source VARCHAR(50) NOT NULL DEFAULT 'DATASET_REPLAY';
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS device_id VARCHAR(255);
    `);

    await client.query(`
      INSERT INTO tenants (id, name) VALUES (1, 'VG Marine Tech Fleet Ops') ON CONFLICT (id) DO NOTHING;
      SELECT setval(pg_get_serial_sequence('tenants', 'id'), COALESCE(MAX(id), 1)) FROM tenants;
      SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1)) FROM users;
      UPDATE users SET onboarding_completed = true WHERE email IN ('admin@eculytics.com', 'user@vgmarine.com');
      INSERT INTO company_profiles (
        tenant_id, user_id, company_name, industry, website, contact_email,
        organization_type, gstin, is_gst_registered, country, state, city,
        postal_code, address, fleet_size, primary_application, description, is_completed
      ) VALUES (
        1, 1, 'VG Marine Tech Fleet Ops', 'Marine', 'https://vgmarine.com', 'contact@vgmarine.com',
        'Fleet Operator', '27AABCV1234F1Z5', true, 'India', 'Maharashtra', 'Mumbai',
        '400001', 'Marine Lines, South Mumbai', '51-200 systems', 'Marine Safety & Vessel Compliance',
        'Primary fleet monitoring and thermal intelligence for electric marine vessels.', true
      ) ON CONFLICT (tenant_id) DO NOTHING;
    `);

    // In production, avoid polluting the database with demo vehicles, mock invoices, and sample work orders
    if (process.env.NODE_ENV !== "production") {
      await client.query(`
        INSERT INTO battery_passports (
          id, battery_id, cell_model, chemistry, nominal_capacity_ah, nominal_voltage_v,
          manufacturer, manufacture_date, total_cycles, total_batches_anchored, status
        ) VALUES (
          'bp-001',
          'BAT-PAN18650PF-001',
          'Panasonic NCR18650PF',
          'LiNiCoAlO2 (NCA)',
          2.9,
          3.6,
          'Panasonic Energy Co., Ltd.',
          TIMESTAMP '2016-01-01',
          0,
          0,
          'ACTIVE'
        )
        ON CONFLICT (battery_id) DO NOTHING;

        INSERT INTO subscriptions (
          id, plan_id, plan_name, tier, amount_monthly, currency,
          billing_cycle, payment_method, status, current_period_start, current_period_end
        ) VALUES (
          'sub-default-enterprise',
          'plan_enterprise_guardian',
          'Enterprise Fleet Guardian',
          'Enterprise',
          2490.0,
          'USD',
          'Monthly (Next charge: Nov 1, 2026)',
          'Corporate Wire (•••• 8921)',
          'Active',
          TIMESTAMP '2026-10-01 00:00:00',
          TIMESTAMP '2026-11-01 00:00:00'
        )
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO billing_invoices (
          id, subscription_id, invoice_number, amount, amount_numeric, currency,
          status, billing_period, pdf_url, paid_at
        ) VALUES
          ('inv-2026-10', 'sub-default-enterprise', 'INV-2026-10', '$2,490.00', 2490.0, 'USD', 'Paid', 'October 2026', '#', TIMESTAMP '2026-10-01 10:15:00'),
          ('inv-2026-09', 'sub-default-enterprise', 'INV-2026-09', '$2,490.00', 2490.0, 'USD', 'Paid', 'September 2026', '#', TIMESTAMP '2026-09-01 09:30:00'),
          ('inv-2026-08', 'sub-default-enterprise', 'INV-2026-08', '$2,490.00', 2490.0, 'USD', 'Paid', 'August 2026', '#', TIMESTAMP '2026-08-01 11:00:00')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO vehicles (
          id, tenant_id, name, fleet, status, battery_id, device_id,
          thermal_risk, cooling_health, sensor_health, maintenance_priority,
          location, tmax, tmin, tavg, delta_t, dtdt
        ) VALUES
          ('V-1042', 1, 'Route Hauler 12', 'Metro North', 'critical', 'BAT-PAN18650PF-001', 'DEV-PAN18650PF-01', 'critical', 'degraded', 'faulty', 'urgent', 'Depot A', 58.2, 45.8, 49.1, 12.4, 0.45),
          ('V-2931', 1, 'City Loop 04', 'Metro North', 'warning', 'B-1092', NULL, 'warning', 'watch', 'healthy', 'high', 'Route 7', 49.1, 38.4, 42.0, 10.7, 0.12),
          ('V-4410', 1, 'Harbor Shuttle 2', 'Coastal', 'watch', 'B-3011', NULL, 'watch', 'healthy', 'watch', 'medium', 'Port Gate', 44.6, 36.2, 39.8, 8.4, 0.06),
          ('V-1188', 1, 'Express 19', 'Coastal', 'healthy', 'B-2201', NULL, 'info', 'healthy', 'healthy', 'low', 'Highway 3', 36.4, 32.1, 34.0, 4.3, 0.02),
          ('V-5502', 1, 'Night Freight 08', 'Metro North', 'healthy', 'B-4419', NULL, 'info', 'healthy', 'healthy', 'low', 'Yard B', 35.1, 31.8, 33.2, 3.3, 0.01)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO work_orders (
          id, tenant_id, vehicle_id, pack_id, issue, priority, assigned_to,
          status, thermal_issue, recommendation, evidence, due_date
        ) VALUES
          ('WO-9401', 1, 'V-1042', 'BAT-PAN18650PF-001', 'Module 4 Hotspot divergence (ΔT > 12°C)', 'urgent', 'Alex Thorne', 'in_progress', 'Persistent hotspot with cooling degradation', 'Advisory: derate power to 50% and inspect cooling loop B.', 'Tmax 58.2°C, ΔT 12.4°C, cooling effectiveness 65%', TIMESTAMP '2026-10-24 18:00:00'),
          ('WO-9402', 1, 'V-2931', 'B-1092', 'NTC Sensor 3 calibration drift vs CNN-LSTM', 'high', 'Sarah Jenkins', 'scheduled', 'Module 2 ΔT above watch band', 'Schedule pack inspection at next depot stop.', 'ΔT 10.7°C over 11 minutes', TIMESTAMP '2026-10-25 12:00:00'),
          ('WO-9403', 1, 'V-4410', 'B-3011', 'Coolant pump pressure decay test', 'routine', 'Marcus Brody', 'open', 'Slower than expected heat rejection', 'Inspect pump flow rate and verify loop pressures.', 'Inlet 18.4°C / Outlet 27.1°C', TIMESTAMP '2026-10-28 09:00:00')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO reports (
          id, tenant_id, type, scope, status, summary, reference, record_count, report_data, generated_at
        ) VALUES
          ('RPT-2026-001', 1, 'Fleet thermal daily', 'Global Fleet Ops', 'ready', '5 vehicles monitored; 1 critical thermal risk, 1 urgent maintenance ticket open.', 'AUDIT-REF-2026-001', 5, '{"healthyCount": 2, "warningCount": 2, "criticalCount": 1, "avgDeltaT": 7.82}'::jsonb, TIMESTAMP '2026-10-22 05:00:00'),
          ('RPT-2026-002', 1, 'Hotspot evidence pack', 'V-1042 / BAT-PAN18650PF-001', 'ready', 'Panasonic NCR18650PF cycle test evidence with RFC 6962 Merkle verification and CNN-LSTM residual tracking.', 'AUDIT-REF-2026-002', 60, '{"batteryId": "BAT-PAN18650PF-001", "cellModel": "Panasonic NCR18650PF", "tmax": 58.2, "residualMean": 0.42}'::jsonb, TIMESTAMP '2026-10-22 08:30:00')
        ON CONFLICT (id) DO NOTHING;
      `);
    }

    client.release();
    console.log("[PostgreSQL] All schema tables verified successfully.");
  } catch (err) {
    console.error("[PostgreSQL] Connection / initialization error:", err);
  }
}
