package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

func setupTestServer(t *testing.T) *httptest.Server {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := openDB(dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	mux := http.NewServeMux()
	registerRoutes(mux, db)
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server
}

func decodeBody[T any](t *testing.T, resp *http.Response) T {
	t.Helper()
	defer resp.Body.Close()

	var value T
	if err := json.NewDecoder(resp.Body).Decode(&value); err != nil {
		t.Fatalf("decode json: %v", err)
	}
	return value
}

func postJSON(t *testing.T, url string, payload any) *http.Response {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	resp, err := http.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	return resp
}

func putJSON(t *testing.T, url string, payload any) *http.Response {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	req, err := http.NewRequest(http.MethodPut, url, bytes.NewReader(body))
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("put: %v", err)
	}
	return resp
}

func sampleComputer() map[string]any {
	return map[string]any{
		"ip_address":      "10.110.1.24",
		"hostname":        "PC-CAB-12",
		"mac_address":     "AA-BB-CC-DD-EE-FF",
		"phone":           "11-24",
		"department_name": "Связь",
		"pc_status":       "В работе",
		"note":            "Основное АРМ",
	}
}

func TestCreateAndListComputers(t *testing.T) {
	server := setupTestServer(t)

	resp := postJSON(t, server.URL+"/computers", sampleComputer())
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create status = %d", resp.StatusCode)
	}
	created := decodeBody[Computer](t, resp)
	if created.ID == 0 {
		t.Fatal("expected created id")
	}
	if created.MACAddress != "aa:bb:cc:dd:ee:ff" {
		t.Fatalf("MAC address = %q", created.MACAddress)
	}
	if created.Network != networkLocal {
		t.Fatalf("network = %q", created.Network)
	}

	listResp, err := http.Get(server.URL + "/computers")
	if err != nil {
		t.Fatal(err)
	}
	list := decodeBody[[]Computer](t, listResp)
	if len(list) != 1 {
		t.Fatalf("list len = %d", len(list))
	}
}

func TestSearchIsCaseInsensitiveForRussian(t *testing.T) {
	server := setupTestServer(t)
	postJSON(t, server.URL+"/computers", sampleComputer()).Body.Close()

	listResp, err := http.Get(server.URL + "/computers?search=" + "связь")
	if err != nil {
		t.Fatal(err)
	}
	list := decodeBody[[]Computer](t, listResp)
	if len(list) != 1 {
		t.Fatalf("expected 1 match, got %d", len(list))
	}
}

func TestMACAddressIsNormalized(t *testing.T) {
	server := setupTestServer(t)
	resp := postJSON(t, server.URL+"/computers", map[string]any{
		"ip_address":  "192.168.1.10",
		"mac_address": "00-11-22-33-44-55",
	})
	created := decodeBody[Computer](t, resp)
	if created.MACAddress != "00:11:22:33:44:55" {
		t.Fatalf("normalized MAC = %q", created.MACAddress)
	}
	if created.Network != networkExternal {
		t.Fatalf("network = %q", created.Network)
	}
}

func TestNetworkFilterAndIPSort(t *testing.T) {
	server := setupTestServer(t)
	postJSON(t, server.URL+"/computers", map[string]any{"ip_address": "10.110.2.5"}).Body.Close()
	postJSON(t, server.URL+"/computers", map[string]any{"ip_address": "10.110.1.20"}).Body.Close()
	postJSON(t, server.URL+"/computers", map[string]any{"ip_address": "192.168.10.2"}).Body.Close()
	postJSON(t, server.URL+"/computers", map[string]any{"ip_address": "8.8.8.8"}).Body.Close()

	localResp, err := http.Get(server.URL + "/computers?network=local")
	if err != nil {
		t.Fatal(err)
	}
	local := decodeBody[[]Computer](t, localResp)
	if len(local) != 2 {
		t.Fatalf("local len = %d", len(local))
	}
	if local[0].IPAddress != "10.110.1.20" || local[1].IPAddress != "10.110.2.5" {
		t.Fatalf("local sort = %s, %s", local[0].IPAddress, local[1].IPAddress)
	}

	externalResp, err := http.Get(server.URL + "/computers?network=external")
	if err != nil {
		t.Fatal(err)
	}
	external := decodeBody[[]Computer](t, externalResp)
	if len(external) != 1 || external[0].IPAddress != "192.168.10.2" {
		t.Fatalf("external = %+v", external)
	}
}

func TestBuildingsCRUDAndFilter(t *testing.T) {
	server := setupTestServer(t)

	createdBuilding := decodeBody[Building](t, postJSON(t, server.URL+"/buildings", map[string]any{
		"name":    "Главный корпус",
		"address": "ул. Ленина, 1",
	}))
	if createdBuilding.ID == 0 || createdBuilding.Address != "ул. Ленина, 1" {
		t.Fatalf("building = %+v", createdBuilding)
	}

	payload := sampleComputer()
	payload["building_id"] = createdBuilding.ID
	createdPC := decodeBody[Computer](t, postJSON(t, server.URL+"/computers", payload))
	if createdPC.BuildingName != "Главный корпус" {
		t.Fatalf("pc building = %q", createdPC.BuildingName)
	}

	filtered, err := http.Get(fmt.Sprintf("%s/computers?building_id=%d", server.URL, createdBuilding.ID))
	if err != nil {
		t.Fatal(err)
	}
	list := decodeBody[[]Computer](t, filtered)
	if len(list) != 1 {
		t.Fatalf("filter len = %d", len(list))
	}

	overviewResp, err := http.Get(server.URL + "/buildings")
	if err != nil {
		t.Fatal(err)
	}
	overview := decodeBody[buildingsOverview](t, overviewResp)
	if overview.Total != 1 || overview.Items[0].ComputersCount != 1 {
		t.Fatalf("overview = %+v", overview)
	}

	delReq, err := http.NewRequest(http.MethodDelete, fmt.Sprintf("%s/buildings/%d", server.URL, createdBuilding.ID), nil)
	if err != nil {
		t.Fatal(err)
	}
	delResp, err := http.DefaultClient.Do(delReq)
	if err != nil {
		t.Fatal(err)
	}
	delResp.Body.Close()
	if delResp.StatusCode != http.StatusNoContent {
		t.Fatalf("delete building status = %d", delResp.StatusCode)
	}

	pcResp, err := http.Get(fmt.Sprintf("%s/computers/%d", server.URL, createdPC.ID))
	if err != nil {
		t.Fatal(err)
	}
	pc := decodeBody[Computer](t, pcResp)
	if pc.BuildingID != nil {
		t.Fatalf("expected unassigned computer, got %+v", pc.BuildingID)
	}
}

func TestGetUpdateDeleteComputer(t *testing.T) {
	server := setupTestServer(t)
	created := decodeBody[Computer](t, postJSON(t, server.URL+"/computers", sampleComputer()))

	getResp, err := http.Get(fmt.Sprintf("%s/computers/%d", server.URL, created.ID))
	if err != nil {
		t.Fatal(err)
	}
	got := decodeBody[Computer](t, getResp)
	if got.Hostname != "PC-CAB-12" {
		t.Fatalf("hostname = %q", got.Hostname)
	}

	updatedPayload := sampleComputer()
	updatedPayload["mac_address"] = "12:34:56:78:9a:bc"
	updatedPayload["pc_status"] = "Ремонт"
	updated := decodeBody[Computer](t, putJSON(t, fmt.Sprintf("%s/computers/%d", server.URL, created.ID), updatedPayload))
	if updated.MACAddress != "12:34:56:78:9a:bc" || updated.PCStatus != "Ремонт" {
		t.Fatalf("update failed: %+v", updated)
	}

	delReq, err := http.NewRequest(http.MethodDelete, fmt.Sprintf("%s/computers/%d", server.URL, created.ID), nil)
	if err != nil {
		t.Fatal(err)
	}
	delResp, err := http.DefaultClient.Do(delReq)
	if err != nil {
		t.Fatal(err)
	}
	delResp.Body.Close()
	if delResp.StatusCode != http.StatusNoContent {
		t.Fatalf("delete status = %d", delResp.StatusCode)
	}
}

func TestValidation(t *testing.T) {
	server := setupTestServer(t)

	resp := postJSON(t, server.URL+"/computers", map[string]any{})
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
	payload := decodeBody[map[string]string](t, resp)
	if payload["error"] != "укажите IP-адрес или имя устройства" {
		t.Fatalf("error = %q", payload["error"])
	}

	createdResp := postJSON(t, server.URL+"/computers", map[string]any{"hostname": "PC-01"})
	if createdResp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 for hostname-only, got %d", createdResp.StatusCode)
	}
	created := decodeBody[Computer](t, createdResp)
	if created.Hostname != "PC-01" {
		t.Fatalf("created = %+v", created)
	}
}

func TestTasksCRUDAndFilter(t *testing.T) {
	server := setupTestServer(t)

	building := decodeBody[Building](t, postJSON(t, server.URL+"/buildings", map[string]any{
		"name":    "Корпус 1",
		"address": "ул. Ленина, 2",
	}))
	pcPayload := sampleComputer()
	pcPayload["building_id"] = building.ID
	computer := decodeBody[Computer](t, postJSON(t, server.URL+"/computers", pcPayload))

	createdResp := postJSON(t, server.URL+"/tasks", map[string]any{
		"title":       "Заменить блок питания",
		"description": "АРМ каб. 12",
		"assignee":    "Иванов",
		"building_id": building.ID,
		"computer_id": computer.ID,
		"status":      "in_progress",
		"due_date":    "2026-10-20",
	})
	if createdResp.StatusCode != http.StatusCreated {
		t.Fatalf("create task status = %d", createdResp.StatusCode)
	}
	created := decodeBody[Task](t, createdResp)
	if created.ID == 0 || created.StatusLabel != "В работе" || created.ComputerHostname != "PC-CAB-12" {
		t.Fatalf("task = %+v", created)
	}

	invalid := postJSON(t, server.URL+"/tasks", map[string]any{"title": ""})
	if invalid.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty title, got %d", invalid.StatusCode)
	}
	invalid.Body.Close()

	postJSON(t, server.URL+"/tasks", map[string]any{
		"title":  "Ожидает деталь",
		"status": "waiting",
	}).Body.Close()

	filteredResp, err := http.Get(server.URL + "/tasks?status=in_progress")
	if err != nil {
		t.Fatal(err)
	}
	filtered := decodeBody[[]Task](t, filteredResp)
	if len(filtered) != 1 || filtered[0].Title != "Заменить блок питания" {
		t.Fatalf("filtered = %+v", filtered)
	}

	updated := decodeBody[Task](t, putJSON(t, server.URL+"/tasks/"+itoa(created.ID), map[string]any{
		"title":       created.Title,
		"description": created.Description,
		"assignee":    created.Assignee,
		"building_id": building.ID,
		"computer_id": computer.ID,
		"status":      "done",
		"due_date":    created.DueDate,
	}))
	if updated.Status != "done" {
		t.Fatalf("status = %q", updated.Status)
	}

	delReq, err := http.NewRequest(http.MethodDelete, server.URL+"/tasks/"+itoa(created.ID), nil)
	if err != nil {
		t.Fatal(err)
	}
	delResp, err := http.DefaultClient.Do(delReq)
	if err != nil {
		t.Fatal(err)
	}
	delResp.Body.Close()
	if delResp.StatusCode != http.StatusNoContent {
		t.Fatalf("delete task status = %d", delResp.StatusCode)
	}
}

func itoa(value int) string {
	return strconv.Itoa(value)
}

func TestExportImportCSV(t *testing.T) {
	server := setupTestServer(t)
	postJSON(t, server.URL+"/computers", sampleComputer()).Body.Close()

	exportResp, err := http.Get(server.URL + "/computers/export")
	if err != nil {
		t.Fatal(err)
	}
	exported, err := io.ReadAll(exportResp.Body)
	exportResp.Body.Close()
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(exported, []byte("Иванов Пётр Сергеевич")) {
		t.Fatalf("export must not contain personal names: %s", exported)
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "computers.csv")
	if err != nil {
		t.Fatal(err)
	}
	csvData := "MAC-адрес;IP-адрес;Имя компьютера;Статус;Здание;Адрес здания\n00:11:22:33:44:55;192.168.1.30;PC-30;На складе;Склад;ул. Мира, 8\n"
	if _, err := io.WriteString(part, csvData); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	importResp, err := http.Post(server.URL+"/computers/import", writer.FormDataContentType(), &body)
	if err != nil {
		t.Fatal(err)
	}
	result := decodeBody[map[string]any](t, importResp)
	if result["created"] != float64(1) {
		t.Fatalf("created = %#v", result["created"])
	}

	overviewResp, err := http.Get(server.URL + "/buildings")
	if err != nil {
		t.Fatal(err)
	}
	overview := decodeBody[buildingsOverview](t, overviewResp)
	if len(overview.Items) != 1 || overview.Items[0].Name != "Склад" {
		t.Fatalf("imported building = %+v", overview.Items)
	}
}
