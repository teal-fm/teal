package worker

import (
	"fmt"
	"runtime"
	"sync"
	"time"

	zmq "github.com/pebbe/zmq4"
)

// RunWorker simulates a worker that connects to the server and processes jobs
func RunWorker(id string, wg *sync.WaitGroup) {
	defer wg.Done()

	// Create a ZeroMQ REQ socket for receiving jobs
	socket, _ := zmq.NewSocket(zmq.REQ)
	defer socket.Close()
	socket.Connect("tcp://localhost:5555")

	for {
		// Send a ready signal to the server
		socket.SendMessage(fmt.Sprintf("READY %s", id), 0)

		// Receive the job
		msg, err := socket.RecvMessage(0)
		if err != nil {
			fmt.Println("Error receiving job:", err)
			continue
		}
		job := msg[0]

		// Process the job
		fmt.Printf("Worker %s received job: %s\n", id, job)
		socket.SendMessage(fmt.Sprintf("RECEIVED %s", job), 0)

		// Simulate processing the job
		fmt.Printf("Worker %s processing job: %s\n", id, job)
		socket.SendMessage(fmt.Sprintf("PROCESSING %s", job), 0)
		time.Sleep(2 * time.Second) // Simulate job processing delay
	}
}

// GetCoreCount returns the number of CPU cores on the current machine
func GetCoreCount() int {
	return runtime.NumCPU()
}
