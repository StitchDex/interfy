# 체계 구성 (기능 브랜치 시험판)

작업 브랜치: `feature/system-configuration-v1`. `main`에는 자동 반영하지 않습니다.

## 메뉴와 설계 원칙

- **인터페이스 설계**: 송신·수신 노드 및 메시지 정의
- **체계 구성**: 노드별 Device ID, HW 탑재, Hostname, SW/HW 고유 ID, IP/NIC 및 통신 연결
- 노드의 기준 데이터는 기존 `integration_targets`입니다. 별도의 중복 노드를 생성하지 않습니다.
- `(reserved1)` 같은 IP는 별도 노드가 아니라 해당 노드의 **예약 IP**로 등록합니다.
- 통신 연결은 입력 문자열 대신 등록된 IP 식별자를 참조하므로 IP와 노드 이름을 수정해도 참조가 유지됩니다.
- IP 주소는 프로젝트 안에서 중복 등록할 수 없고, Device ID도 한 프로젝트 내 중복할 수 없습니다.
- Client PORT는 선택적으로 입력할 수 있습니다 (동적 로컬 포트 대응).
- 프로젝트의 DB 백업/복원에는 체계 구성 테이블 3개도 함께 포함합니다.

## 시험 방법 (기존 main과 별개)

작업 PC에서 `git status`로 로컬 변경사항을 먼저 확인하세요.
브랜치 시험 시 기존 Interfy DB를 사용한다면, 사전에 PostgreSQL 백업을 보관하세요.

```powershell
git fetch origin
git switch feature/system-configuration-v1
.\rancher.cmd up moby
```

실행 후 프로젝트를 선택하고, 왼쪽 **설계 → 체계 구성**에서
**장비·SW / IP·NIC / 통신 연결** 탭을 확인합니다.

신규 테이블만 추가하며, 기존 프로젝트·노드·메시지 데이터는
자동으로 변경하거나 예제 데이터로 채우지 않습니다.

```powershell
# 테스트는 backend 환경에서
python -m unittest discover -s tests -p "test_system_configuration.py" -v
```

원래 버전으로 돌아가려면 해당 브랜치에서 수정한 내용이 저장되어 있는지
확인한 다음 `git switch main`, `git pull origin main` 후 다시 빌드하세요.

## 향후 확장 (이번 시험판 미구현)

- 기존 장비 ID/IP/PORT 엑셀 시트 일괄 가져오기 및 내보내기
- 별도 HW 목록을 통한 다수 SW-단일 HW 탑재 모델
- TCP 연결도를 기존 메시지 송수신 관계도에 오버레이하는 기능
- IP/PORT/장비 식별자 변경 이력과 비교 화면
