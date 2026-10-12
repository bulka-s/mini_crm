package main

import (
	"net"
	"strings"
)

const (
	networkLocal    = "local"
	networkExternal = "external"
	networkOther    = "other"
)

func classifyNetwork(ip string) string {
	parsed := net.ParseIP(strings.TrimSpace(ip))
	if parsed == nil {
		return networkOther
	}
	v4 := parsed.To4()
	if v4 == nil {
		return networkOther
	}
	if v4[0] == 10 && v4[1] == 110 {
		return networkLocal
	}
	if v4[0] == 192 && v4[1] == 168 {
		return networkExternal
	}
	return networkOther
}

func networkLabel(kind string) string {
	switch kind {
	case networkLocal:
		return "Локальная 10.110"
	case networkExternal:
		return "Внешняя 192.168"
	default:
		return "Другая"
	}
}

func ipSortKey(ip string) (a, b, c, d int) {
	parsed := net.ParseIP(strings.TrimSpace(ip))
	if parsed == nil {
		return 999, 999, 999, 999
	}
	v4 := parsed.To4()
	if v4 == nil {
		return 999, 999, 999, 999
	}
	return int(v4[0]), int(v4[1]), int(v4[2]), int(v4[3])
}

func networkRank(kind string) int {
	switch kind {
	case networkLocal:
		return 0
	case networkExternal:
		return 1
	default:
		return 2
	}
}

func lessByIP(left, right string) bool {
	la, lb, lc, ld := ipSortKey(left)
	ra, rb, rc, rd := ipSortKey(right)
	if la != ra {
		return la < ra
	}
	if lb != rb {
		return lb < rb
	}
	if lc != rc {
		return lc < rc
	}
	if ld != rd {
		return ld < rd
	}
	return left < right
}
