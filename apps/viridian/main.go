package main

import (
	"fmt"
	"sync"

	server "viridian/server"
	worker "viridian/worker"
)

func main() {
	var wg sync.WaitGroup

	// Run the server in a goroutine
	go server.RunServer()

	// Simulate workers, each running in a separate goroutine
	workerCount := worker.GetCoreCount()
	fmt.Printf("Starting %d workers\n", workerCount)
	for i := 1; i <= workerCount; i++ {
		fmt.Printf("Starting worker %d\n", i)
		workerID := fmt.Sprintf("worker-%d", i)
		wg.Add(1)
		go worker.RunWorker(workerID, &wg)
	}

	// Wait for all workers to complete (this won't happen in this example since workers run indefinitely)
	wg.Wait()
}
