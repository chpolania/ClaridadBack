CREATE DATABASE IF NOT EXISTS claridad
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE claridad;

CREATE TABLE users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  email_normalized VARCHAR(320) NOT NULL UNIQUE,
  email_verified_at DATETIME(3) NULL,
  display_name VARCHAR(255) NULL,
  avatar_url TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  disabled_at DATETIME(3) NULL
) ENGINE=InnoDB;

CREATE TABLE auth_identities (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  provider ENUM('email', 'google', 'facebook') NOT NULL,
  provider_subject VARCHAR(255) NOT NULL,
  provider_email VARCHAR(320) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY auth_identities_provider_subject_uq (provider, provider_subject),
  KEY auth_identities_user_id_idx (user_id),
  CONSTRAINT auth_identities_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE email_login_challenges (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email_normalized VARCHAR(320) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  request_ip VARCHAR(45) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  consumed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY email_login_challenges_email_created_idx (email_normalized, created_at DESC),
  KEY email_login_challenges_ip_created_idx (request_ip, created_at DESC)
) ENGINE=InnoDB;

CREATE TABLE auth_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  refresh_token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  replaced_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY auth_sessions_user_id_idx (user_id),
  CONSTRAINT auth_sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT auth_sessions_replaced_by_fk FOREIGN KEY (replaced_by) REFERENCES auth_sessions(id)
) ENGINE=InnoDB;

CREATE TABLE user_calendars (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Bogota',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY user_calendars_user_id_uq (user_id),
  UNIQUE KEY user_calendars_id_user_id_uq (id, user_id),
  CONSTRAINT user_calendars_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE calendar_tasks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  calendar_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  starts_at_utc DATETIME(3) NOT NULL,
  ends_at_utc DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  KEY calendar_tasks_user_start_idx (user_id, starts_at_utc),
  KEY calendar_tasks_calendar_start_idx (calendar_id, starts_at_utc),
  CONSTRAINT calendar_tasks_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT calendar_tasks_calendar_user_fk
    FOREIGN KEY (calendar_id, user_id)
    REFERENCES user_calendars(id, user_id) ON DELETE CASCADE,
  CONSTRAINT calendar_tasks_valid_range_chk
    CHECK (ends_at_utc > starts_at_utc)
) ENGINE=InnoDB;

CREATE TABLE pending_calendar_tasks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  suggested_date DATE NULL,
  suggested_start_time TIME NULL,
  source_text MEDIUMTEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY pending_calendar_tasks_user_created_idx (user_id, created_at),
  CONSTRAINT pending_calendar_tasks_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
