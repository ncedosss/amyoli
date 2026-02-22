-- Authorized user emails for signup
CREATE TABLE am."AuthorizedUserEmails" (
    Id SERIAL PRIMARY KEY,
    EmailAddress VARCHAR(100) UNIQUE
);

-- Insert authorized emails
-- Insert authorized emails only if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM am."AuthorizedUserEmails" 
        WHERE "emailaddress" = 'ncedosss@gmail.com'
    ) THEN
        INSERT INTO am."AuthorizedUserEmails" ("emailaddress") 
        VALUES ('ncedosss@gmail.com');
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM am."AuthorizedUserEmails" 
        WHERE "emailaddress" = 'ngindanas@yahoo.com'
    ) THEN
        INSERT INTO am."AuthorizedUserEmails" ("emailaddress") 
        VALUES ('ngindanas@yahoo.com');
    END IF;
END
$$;
-- Create schema 'am' if not exists
CREATE SCHEMA IF NOT EXISTS am;

CREATE TABLE am."User" (
    Id SERIAL PRIMARY KEY,
    Name VARCHAR(100),
    Surname VARCHAR(100),
    Username VARCHAR(100) UNIQUE,
    EmailAddress VARCHAR(100) UNIQUE,
    Password VARCHAR(255),
    Confirmed BOOLEAN DEFAULT FALSE,
    ConfirmationToken VARCHAR(64)
);

-- Driver table
CREATE TABLE am."Driver" (
    Id SERIAL PRIMARY KEY,
    Name VARCHAR(100),
    Surname VARCHAR(100)
);

-- ShiftType table
CREATE TABLE am."ShiftType" (
    Id SERIAL PRIMARY KEY,
    Name VARCHAR(100),
    Description TEXT
);

-- ShiftRate table
CREATE TABLE am."ShiftRate" (
    Id SERIAL PRIMARY KEY,
    ShiftTypeId INTEGER REFERENCES am."ShiftType"(Id),
    Rate NUMERIC(10,2)
);

CREATE TABLE am."Trip" (
    Id SERIAL PRIMARY KEY,
    ShiftTypeId INTEGER REFERENCES am."ShiftType"(Id),
    Direction VARCHAR(20), -- 'To home' or 'To Work'
    DriverId INTEGER REFERENCES am."Driver"(Id),
    Trip_Date TIMESTAMP,
    Deleted BOOLEAN DEFAULT FALSE,
    Date_Created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    User_Created INTEGER REFERENCES am."User"(Id) NOT NULL,
    Date_Updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    User_Updated INTEGER REFERENCES am."User"(Id)
);

-- Lookup values for ShiftType
INSERT INTO am."ShiftType" (Name, Description) VALUES
    ('normal_morning', 'Normal shift morning'),
    ('normal_after', 'Normal shift afternoon'),
    ('normal_night', 'Normal shift night'),
    ('weekly', 'Weekly shift'),
    ('weekend_ot', 'Weekend Overtime'),
    ('weekend', 'Weekend'),
    ('staff', 'Staff');

-- Lookup values for Driver
INSERT INTO am."Driver" (Name, Surname) VALUES
    ('Driver', '1'),
    ('Driver', '2'),
    ('Driver', '3');

INSERT INTO am."ShiftRate" (ShiftTypeId, Rate) VALUES
    (1, 259.34),
    (2, 259.34),
    (3, 259.34),
    (4, 272.31),
    (5, 272.31),
    (6, 272.31),
    (7, 272.31);


-- Invoice table
CREATE TABLE am."Invoice" (
    Invoice_No SERIAL PRIMARY KEY,
    Customer_Id VARCHAR(50) DEFAULT 'AF005',
    Invoice_Date DATE NOT NULL DEFAULT CURRENT_DATE,
    Terms VARCHAR(50) DEFAULT 'On Receipt',
    Total_Amount NUMERIC(12,2)
);

-- Invoice Detail table
CREATE TABLE am."Invoice_Detail" (
    Id SERIAL PRIMARY KEY,
    Invoice_No INTEGER REFERENCES am."Invoice"(Invoice_No),
    Description VARCHAR(255),
    Rate NUMERIC(10,2),
    Qty INTEGER,
    Amount NUMERIC(12,2)
);