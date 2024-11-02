package types

import (
	"strconv"
	"sync"
)

// Job represents a job with an ID and status
type Job struct {
	ID     string
	Status string
}

// Server represents the state of the server, including jobs, worker-job associations, and job status
type Server struct {
	Jobs       []Job             // Job queue
	WorkerJobs map[string]string // Mapping worker ID -> job ID
	JobStatus  map[string]string // Mapping job ID -> status
	Mu         sync.Mutex        // Mutex to handle concurrency
}

func (s *Server) AddJob() Job {
	s.Mu.Lock()
	defer s.Mu.Unlock()
	job := Job{"job" + strconv.Itoa(len(s.Jobs)), "pending"}
	s.Jobs = append(s.Jobs, job)

	return job
}

// TrackJob assigns a job to a worker and marks it as in-progress
func (s *Server) TrackJob(workerID, jobID string) {
	s.Mu.Lock()
	defer s.Mu.Unlock()
	s.WorkerJobs[workerID] = jobID
	s.JobStatus[jobID] = "in-progress"
}

// MarkJobCompleted marks a job as completed and removes the worker-job association
func (s *Server) MarkJobCompleted(workerID string) {
	s.Mu.Lock()
	defer s.Mu.Unlock()
	jobID := s.WorkerJobs[workerID]
	s.JobStatus[jobID] = "completed"
	delete(s.WorkerJobs, workerID) // Remove worker-job association
}
