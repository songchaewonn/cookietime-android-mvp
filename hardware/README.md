# CookieTime Uno + HC-06 LCD 연결

이 폴더의 `cookietime_uno/cookietime_uno.ino`는 Uno와 HC-06 사이의 메시지를 받아 16x2 I2C LCD에 집중 상태와 앱 타이머를 표시합니다. 웹 앱은 데스크톱 Chrome의 Web Serial을 사용하고, Android 앱은 내장 Bluetooth Classic SPP 연결을 사용합니다.

## 회로

- HC-06 TXD → Uno D10
- Uno D11 → HC-06 RXD 분압 회로 → GND
- RXD 분압: 같은 값 저항 3개 사용. D11에서 RXD 노드까지 저항 1개, RXD 노드에서 GND까지 같은 저항 2개 직렬. 1kΩ 세 개 또는 220Ω 세 개를 사용합니다. 1kΩ와 220Ω을 섞지 마세요.
- HC-06 VCC/GND → 브레드보드 전원 레일
- LCD VCC/GND → 5V/GND, SDA/SCL → Uno A4/A5
- 누름 스위치 → D2와 GND (스케치 내부 풀업 사용)
- 부저(선택) → D8과 GND

Uno D11의 5V 신호가 HC-06 RXD에 직접 들어가지 않도록 분압 저항을 사용합니다. 배선을 바꾸기 전에 USB 전원을 분리하세요.

## 스케치 올리기

1. Arduino IDE에서 `hardware/cookietime_uno/cookietime_uno.ino`를 엽니다.
2. 라이브러리 관리에서 `LiquidCrystal I2C` 라이브러리를 설치합니다.
3. LCD 백팩 주소가 `0x27`이 아니면 스케치의 `LCD_ADDRESS`를 `0x3F`로 바꿉니다.
4. 보드 `Arduino Uno`와 연결된 USB 포트를 선택해 업로드합니다.
5. LCD에 `COOKIE TIME / READY - APP BTN`이 보이는지 확인합니다.

## 데스크톱 웹 연결

1. HC-06을 컴퓨터 Bluetooth 설정에서 먼저 페어링합니다.
2. 최신 Chrome 또는 Edge에서 HTTPS 웹 앱을 열고 집중 화면으로 이동합니다.
3. `LCD 타이머 연결`을 누르고 포트 선택 창에서 HC-06을 선택합니다. 포트 속도는 9600입니다.
4. 집중 시작/쉬기/마치기를 눌러 LCD가 `FOCUSING`, `FOCUS PAUSED`, `READY` 상태로 바뀌는지 확인합니다.

## Android 앱 연결

1. Android Bluetooth 설정에서 HC-06을 페어링합니다.
2. Android 앱의 집중 화면에서 `LCD 타이머 연결`을 누르고 HC-06을 선택합니다.
3. Bluetooth 연결 권한을 허용하고 LCD 상태를 확인합니다.

연결된 기기 버튼은 짧게 누르면 시작/쉬기/재개, 0.9초 이상 길게 누르면 현재 집중을 마칩니다. LCD 시간은 앱의 연속 집중 시간과 동기화됩니다.

## 직렬 메시지

- 앱 → 기기: `READY`, `SYNC:<연속집중초>`, `PAUSE`, `STOP`
- 기기 → 앱: `BTN` (시작 또는 마치기), `PAUSE_BTN` (쉬기 또는 재개)
- 모든 메시지는 줄바꿈으로 끝나며 속도는 9600 baud입니다.

웹 연결은 Web Serial을 지원하는 데스크톱 Chrome/Edge가 필요합니다. 이 스케치는 Uno + HC-06 Classic Bluetooth 방식이며 ESP32 BLE 연결과는 다른 프로토콜입니다. 실제 보드에서 연결 및 LCD 표시를 확인한 상태는 아닙니다.
