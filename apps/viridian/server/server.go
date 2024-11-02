package server

import (
	"fmt"
	"time"

	"viridian/types"

	zmq "github.com/pebbe/zmq4"
)

// RunServer launches the server that distributes jobs to workers
func RunServer() {
	server := &types.Server{
		Jobs:       []types.Job{{"job1", "pending"}, {"job2", "pending"}, {"job3", "pending"}},
		WorkerJobs: make(map[string]string),
		JobStatus:  make(map[string]string),
	}

	// Initialize job status
	for _, job := range server.Jobs {
		server.JobStatus[job.ID] = "pending"
	}

	// Create a ZeroMQ ROUTER socket for distributing jobs
	socket, _ := zmq.NewSocket(zmq.ROUTER)
	defer socket.Close()
	socket.Bind("tcp://*:5555")

	for len(server.Jobs) > 0 {
		// Wait for a worker to send a ready message
		workerAddr, _ := socket.RecvMessage(0)

		fmt.Printf("Received ready message from worker %s\n", workerAddr)

		fmt.Print(workerAddr[2])

		// Lock jobs to pick the next one safely
		server.Mu.Lock()
		if len(server.Jobs) == 0 {
			server.Mu.Unlock()
			continue
		}
		job := server.Jobs[0]
		server.Jobs = server.Jobs[1:]
		server.Mu.Unlock()

		// Track the job for this worker
		server.TrackJob(workerAddr[0], job.ID)

		// Send job to the worker
		fmt.Printf("Sending job %s to worker %s\n", job.ID, workerAddr[0])
		socket.SendMessage(workerAddr[0], "", job.ID)

		time.Sleep(1 * time.Second) // Simulate a delay

		// In a real-world scenario, this would be based on a worker response
		server.MarkJobCompleted(workerAddr[0])
	}

	fmt.Println("All jobs processed")
}
