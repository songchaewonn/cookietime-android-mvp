/*
 * CookieTime timer bridge
 * Board: Arduino Uno R3 + HC-06 + 16x2 I2C LCD + momentary button + buzzer
 * Install "LiquidCrystal I2C" from Arduino IDE Library Manager.
 *
 * HC-06 UART is 9600 baud. D11 -> HC-06 RXD through a resistor divider;
 * HC-06 TXD -> D10. The web/Android app is the source of timer time.
 */
#include <Wire.h>
#include <SoftwareSerial.h>
#include <LiquidCrystal_I2C.h>
#include <stdlib.h>
#include <string.h>

const uint8_t BT_RX_PIN = 10; // Uno receives from HC-06 TXD
const uint8_t BT_TX_PIN = 11; // Uno sends to HC-06 RXD (use divider)
const uint8_t BUTTON_PIN = 2; // button between D2 and GND
const uint8_t BUZZER_PIN = 8; // optional passive buzzer between D8 and GND
const uint8_t LCD_ADDRESS = 0x27; // try 0x3F if the LCD stays blank

SoftwareSerial bluetooth(BT_RX_PIN, BT_TX_PIN);
LiquidCrystal_I2C lcd(LCD_ADDRESS, 16, 2);

enum TimerMode : uint8_t { MODE_READY, MODE_FOCUS, MODE_PAUSED };
TimerMode mode = MODE_READY;
unsigned long focusSeconds = 0;
unsigned long pressedAt = 0;
bool buttonWasDown = false;
bool longPressSent = false;
char usbLine[48];
char bluetoothLine[48];
uint8_t usbLength = 0;
uint8_t bluetoothLength = 0;

void printPadded(uint8_t row, const char *text) {
  lcd.setCursor(0, row);
  lcd.print(text);
  for (uint8_t i = strlen(text); i < 16; i++) lcd.print(' ');
}

void drawTimer() {
  char line[17];
  unsigned long hours = focusSeconds / 3600;
  unsigned long minutes = (focusSeconds / 60) % 60;
  unsigned long seconds = focusSeconds % 60;
  if (hours > 0) snprintf(line, sizeof(line), "%02lu:%02lu:%02lu", hours % 100, minutes, seconds);
  else snprintf(line, sizeof(line), "%02lu:%02lu", minutes, seconds);

  if (mode == MODE_READY) {
    printPadded(0, "COOKIE TIME");
    printPadded(1, "READY - APP BTN");
  } else if (mode == MODE_PAUSED) {
    printPadded(0, "FOCUS PAUSED");
    printPadded(1, line);
  } else {
    printPadded(0, "FOCUSING");
    printPadded(1, line);
  }
}

void sendButtonEvent(const char *message) {
  bluetooth.println(message);
  Serial.println(message);
  tone(BUZZER_PIN, 1800, 70);
}

void handleCommand(char *command) {
  while (*command == ' ' || *command == '\t') command++;
  size_t length = strlen(command);
  while (length > 0 && (command[length - 1] == ' ' || command[length - 1] == '\t' || command[length - 1] == '\r')) command[--length] = '\0';
  if (length == 0) return;

  if (strcmp(command, "READY") == 0) {
    mode = MODE_READY;
    focusSeconds = 0;
  } else if (strcmp(command, "PAUSE") == 0) {
    mode = MODE_PAUSED;
  } else if (strcmp(command, "STOP") == 0) {
    mode = MODE_READY;
    focusSeconds = 0;
  } else if (strncmp(command, "SYNC:", 5) == 0) {
    char *end = nullptr;
    unsigned long incoming = strtoul(command + 5, &end, 10);
    if (end != command + 5) {
      focusSeconds = incoming;
      mode = MODE_FOCUS;
    }
  } else if (strcmp(command, "PING") == 0) {
    bluetooth.println("OK");
    Serial.println("OK");
  } else {
    return;
  }
  drawTimer();
}

void readLines(Stream &stream, char *buffer, uint8_t &used) {
  while (stream.available()) {
    char incoming = (char)stream.read();
    if (incoming == '\n') {
      buffer[used] = '\0';
      handleCommand(buffer);
      used = 0;
    } else if (incoming != '\r') {
      if (used < 47) buffer[used++] = incoming;
      else used = 0;
    }
  }
}

void handleButton() {
  bool down = digitalRead(BUTTON_PIN) == LOW;
  unsigned long now = millis();

  if (down && !buttonWasDown) {
    buttonWasDown = true;
    pressedAt = now;
    longPressSent = false;
  }
  if (down && buttonWasDown && !longPressSent && mode != MODE_READY && now - pressedAt >= 900) {
    longPressSent = true;
    sendButtonEvent("BTN"); // long press ends an active focus session
    mode = MODE_READY;
    focusSeconds = 0;
    drawTimer();
  }
  if (!down && buttonWasDown) {
    buttonWasDown = false;
    if (longPressSent) return;
    if (mode == MODE_READY) {
      sendButtonEvent("BTN"); // short press starts focus
    } else {
      sendButtonEvent("PAUSE_BTN"); // short press pauses or resumes
      mode = mode == MODE_FOCUS ? MODE_PAUSED : MODE_FOCUS;
      drawTimer();
    }
  }
}

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  Serial.begin(9600); // optional direct USB serial connection
  bluetooth.begin(9600);
  lcd.init();
  lcd.backlight();
  drawTimer();
}

void loop() {
  readLines(Serial, usbLine, usbLength);
  readLines(bluetooth, bluetoothLine, bluetoothLength);
  handleButton();
}
