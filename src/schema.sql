-- DELIMITER CHANGED FOR COMPATIBILITY WITH MYSQL.CONNECTOR:
-- ALSO, TRIGGER CREATION WITHOUT DELIMITERS FOR WORKING WITH MYSQL.CONNECTOR:

CREATE DATABASE IF NOT EXISTS alexicon CHARACTER SET utf8 COLLATE utf8_unicode_ci$$

USE alexicon$$

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(63) NOT NULL,
    surname VARCHAR(63) NOT NULL,
    nickname VARCHAR(63) NOT NULL,
    at_sign VARCHAR(63),
    birthday DATE NOT NULL,
    gender VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    password VARCHAR(256),
    current_profile_pic VARCHAR(255),
    current_cover_pic VARCHAR(255),
    list_positive JSON DEFAULT '[]',
    list_negative JSON DEFAULT '[]',
    list_positive_external JSON DEFAULT '[]',
    list_negative_external JSON DEFAULT '[]',
    api_code VARCHAR(63),
    registration_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified TINYINT(1) NOT NULL DEFAULT 0,
    verify_key VARCHAR(128),
    origin VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci$$

CREATE TABLE IF NOT EXISTS services (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner_id BIGINT UNSIGNED NOT NULL,
    yip_net TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci$$

CREATE TABLE IF NOT EXISTS posts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner_id BIGINT UNSIGNED NOT NULL,
    content MEDIUMTEXT NOT NULL,
    media JSON DEFAULT '[]',
    shared_by_list JSON DEFAULT '[]',
    share_id BIGINT(20) DEFAULT 0,
    private_post TINYINT(1) NOT NULL,
    nsfw_post TINYINT(1) NOT NULL,
    comment_count BIGINT(20) DEFAULT 0,
    list_vote_heart JSON DEFAULT '[]',
    list_vote_up JSON DEFAULT '[]',
    list_vote_down JSON DEFAULT '[]',
    post_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origin VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci$$

CREATE TABLE IF NOT EXISTS comments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT UNSIGNED NOT NULL,
    owner_id BIGINT UNSIGNED NOT NULL,
    content MEDIUMTEXT NOT NULL,
    media JSON DEFAULT '[]',
    list_vote_heart JSON DEFAULT '[]',
    list_vote_up JSON DEFAULT '[]',
    list_vote_down JSON DEFAULT '[]',
    comment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origin VARCHAR(255),
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci$$

CREATE TABLE IF NOT EXISTS messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sender_id BIGINT UNSIGNED NOT NULL,
    receiver_id BIGINT UNSIGNED NOT NULL,
    content TEXT NOT NULL,
    media JSON DEFAULT '[]',
    list_vote_heart JSON DEFAULT '[]',
    list_vote_up JSON DEFAULT '[]',
    list_vote_down JSON DEFAULT '[]',
    msg_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origin VARCHAR(255),
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci$$

CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(63) NOT NULL,
    participants JSON DEFAULT '[]'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci$$

-- Creates a record on 'services' when new user:
DROP TRIGGER IF EXISTS after_user_insert$$
CREATE TRIGGER after_user_insert
AFTER INSERT ON users
FOR EACH ROW
BEGIN
    INSERT INTO services (owner_id) VALUES (NEW.id);
END$$

-- Deletes a record on 'services' when user is deleted:
DROP TRIGGER IF EXISTS after_user_delete$$
CREATE TRIGGER after_user_delete
AFTER DELETE ON users
FOR EACH ROW
BEGIN
    DELETE FROM services WHERE owner_id = OLD.id;
END$$

-- Increments comment_count +1 when new comment:
DROP TRIGGER IF EXISTS after_comment_insert$$
CREATE TRIGGER after_comment_insert
AFTER INSERT ON comments
FOR EACH ROW
BEGIN
    UPDATE posts SET comment_count = COALESCE(comment_count, 0) + 1 WHERE id = NEW.post_id;
END$$

-- Decrements comment_count -1 when comment deleted:
DROP TRIGGER IF EXISTS after_comment_delete$$
CREATE TRIGGER after_comment_delete
AFTER DELETE ON comments
FOR EACH ROW
BEGIN
    UPDATE posts SET comment_count = COALESCE(comment_count, 0) - 1 WHERE id = OLD.post_id;
END$$


